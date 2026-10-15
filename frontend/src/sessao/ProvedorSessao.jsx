import { useCallback, useEffect, useMemo, useState } from 'react'
import { limparTokens, obterTokens, salvarTokens } from '../servicos/armazenamentoTokens'
import * as autenticacao from '../servicos/autenticacao'
import { ContextoSessao } from './contexto'

export default function ProvedorSessao({ children }) {
  const [usuario, setUsuario] = useState(null)
  // Só precisa carregar se já existe um token guardado de uma visita anterior.
  const [carregando, setCarregando] = useState(() => Boolean(obterTokens()))

  useEffect(() => {
    if (!obterTokens()) return
    let ativo = true
    autenticacao
      .buscarUsuarioLogado()
      .then((dados) => ativo && setUsuario(dados))
      .catch(() => {
        limparTokens()
      })
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [])

  const entrar = useCallback(async (login, senha, manterConectado) => {
    const resposta = await autenticacao.entrar(login, senha)
    salvarTokens(resposta, manterConectado)
    setUsuario(resposta.usuario)
    return resposta.usuario
  }, [])

  const cadastrar = useCallback(async (dados) => {
    const resposta = await autenticacao.cadastrar(dados)
    // Quem acabou de criar a conta fica conectado só nesta sessão do navegador.
    salvarTokens(resposta, false)
    setUsuario(resposta.usuario)
    return resposta.usuario
  }, [])

  const sair = useCallback(async () => {
    const refresh = obterTokens()?.refresh
    try {
      if (refresh) await autenticacao.sair(refresh)
    } catch {
      // mesmo que a API falhe, a sessão local é encerrada
    }
    limparTokens()
    setUsuario(null)
  }, [])

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, cadastrar, sair }),
    [usuario, carregando, entrar, cadastrar, sair],
  )

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}

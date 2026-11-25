import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alerta from '../../componentes/formulario/Alerta'
import BotaoEnviar from '../../componentes/formulario/BotaoEnviar'
import CampoSenha from '../../componentes/formulario/CampoSenha'
import MedidorForcaSenha from '../../componentes/formulario/MedidorForcaSenha'
import { redefinirSenha } from '../../servicos/autenticacao'
import estilos from './CartaoAutenticacao.module.css'

// Tela inferida: aberta pelo link enviado por e-mail (/redefinir-senha/:uid/:token).
export default function PaginaRedefinirSenha() {
  const { uid, token } = useParams()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [concluido, setConcluido] = useState('')

  const senhasDiferentes = confirmar !== '' && confirmar !== novaSenha

  async function aoEnviar(evento) {
    evento.preventDefault()
    if (!novaSenha || !confirmar || senhasDiferentes) {
      setErros({
        nova_senha: novaSenha ? undefined : 'Crie uma senha.',
        confirmar_senha: !confirmar ? 'Repita a senha.' : senhasDiferentes ? 'As senhas não coincidem.' : undefined,
      })
      return
    }
    setEnviando(true)
    setErroGeral('')
    try {
      const resposta = await redefinirSenha({ uid, token, nova_senha: novaSenha, confirmar_senha: confirmar })
      setConcluido(resposta.detalhe)
    } catch (falha) {
      setErros({ nova_senha: falha.doCampo?.('nova_senha'), confirmar_senha: falha.doCampo?.('confirmar_senha') })
      setErroGeral(falha.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={estilos.pagina}>
      <section className={`${estilos.cartao} ${estilos.estreito}`} aria-labelledby="titulo-redefinir">
        <header className={estilos.cabecalho}>
          <p className={estilos.sobretitulo}>Recuperar acesso</p>
          <h1 id="titulo-redefinir" className={estilos.titulo}>
            Criar nova senha
          </h1>
        </header>

        {concluido ? (
          <>
            <Alerta tipo="sucesso">{concluido}</Alerta>
            <p className={estilos.convite}>
              <Link to="/entrar">Ir para a tela de entrar →</Link>
            </p>
          </>
        ) : (
          <form className={estilos.formulario} onSubmit={aoEnviar} noValidate>
            <Alerta>{erroGeral}</Alerta>
            {/inválido|expirou/.test(erroGeral) && (
              <p className={estilos.convite}>
                <Link to="/esqueci-senha">Pedir um novo link →</Link>
              </p>
            )}
            <div>
              <CampoSenha
                variante="arredondado"
                rotulo="Nova senha"
                obrigatorio
                autoComplete="new-password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                erro={erros.nova_senha}
              />
              {!erros.nova_senha && <MedidorForcaSenha senha={novaSenha} />}
            </div>
            <CampoSenha
              variante="arredondado"
              rotulo="Confirmar nova senha"
              obrigatorio
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              erro={erros.confirmar_senha ?? (senhasDiferentes ? 'As senhas não coincidem.' : undefined)}
            />
            <BotaoEnviar carregando={enviando} textoCarregando="Salvando…">
              Salvar nova senha
            </BotaoEnviar>
          </form>
        )}
      </section>
    </div>
  )
}

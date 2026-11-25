import { useCallback, useEffect, useRef, useState } from 'react'

const ESPERAS_RECONEXAO = [500, 1000, 2000, 4000, 8000]
const FECHAMENTOS_DEFINITIVOS = new Set([4403, 4404])

/**
 * Conecta ao WebSocket da partida e devolve o último retrato enviado pelo servidor.
 * Reconecta sozinho se a conexão cair (o estudante volta com os mesmos pontos).
 *
 * `obterEndereco` é chamado a cada conexão (o professor renova o token antes).
 * Retorna { estado, conexao: 'conectando'|'aberta'|'reconectando'|'encerrada', aviso, enviar, desvio }.
 */
export function usePartidaAoVivo(obterEndereco) {
  const [estado, setEstado] = useState(null)
  const [conexao, setConexao] = useState('conectando')
  const [aviso, setAviso] = useState('')
  const [desvio, setDesvio] = useState(0)
  const socket = useRef(null)
  const obter = useRef(obterEndereco)

  useEffect(() => {
    obter.current = obterEndereco
  }, [obterEndereco])

  useEffect(() => {
    let ativo = true
    let tentativa = 0
    let espera = null

    async function conectar() {
      let endereco
      try {
        endereco = await obter.current()
      } catch {
        endereco = null
      }
      if (!ativo) return
      if (!endereco) {
        setConexao('encerrada')
        setAviso('Não foi possível entrar nesta partida.')
        return
      }
      const ws = new WebSocket(endereco)
      socket.current = ws
      ws.onopen = () => {
        tentativa = 0
        if (ativo) setConexao('aberta')
      }
      ws.onmessage = (evento) => {
        if (!ativo) return
        let mensagem
        try {
          mensagem = JSON.parse(evento.data)
        } catch {
          return
        }
        if (mensagem.tipo === 'erro') {
          setAviso(mensagem.mensagem)
          return
        }
        if (mensagem.agora) setDesvio(mensagem.agora - Date.now())
        setAviso('')
        setEstado(mensagem)
      }
      ws.onclose = (evento) => {
        if (!ativo) return
        if (FECHAMENTOS_DEFINITIVOS.has(evento.code)) {
          setConexao('encerrada')
          return
        }
        setConexao('reconectando')
        const atraso = ESPERAS_RECONEXAO[Math.min(tentativa, ESPERAS_RECONEXAO.length - 1)]
        tentativa += 1
        espera = setTimeout(conectar, atraso)
      }
    }

    conectar()
    return () => {
      ativo = false
      clearTimeout(espera)
      socket.current?.close()
    }
  }, [])

  const enviar = useCallback((acao, dados = {}) => {
    const ws = socket.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ acao, ...dados }))
      return true
    }
    return false
  }, [])

  return { estado, conexao, aviso, enviar, desvio }
}

/** Segundos que faltam até `prazo` (em ms do servidor), atualizado algumas vezes por segundo. */
export function useTempoRestante(prazo, desvio) {
  const calcular = useCallback(
    () => (prazo ? Math.max(Math.ceil((prazo - (Date.now() + desvio)) / 1000), 0) : 0),
    [prazo, desvio],
  )
  const [agora, setAgora] = useState(() => ({ prazo, valor: calcular() }))

  useEffect(() => {
    if (!prazo) return undefined
    const relogio = setInterval(() => setAgora({ prazo, valor: calcular() }), 250)
    return () => clearInterval(relogio)
  }, [prazo, calcular])

  return agora.prazo === prazo ? agora.valor : calcular()
}

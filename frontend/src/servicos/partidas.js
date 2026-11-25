import { api } from './api'
import { obterTokens } from './armazenamentoTokens'

export const abrirSala = (quiz, limite) =>
  api('/partidas/', { metodo: 'POST', corpo: { quiz, limite_participantes: limite } })

export const buscarPartida = (id) => api(`/partidas/${id}/`)

export const entrarNaPartida = (pin, apelido) =>
  api('/partidas/entrar/', { metodo: 'POST', corpo: { pin, apelido } })

// ----- credencial do estudante (para voltar à partida no mesmo aparelho) -----

const CHAVE_LOCAL = 'sabia.partida'

export function guardarParticipacao(dados) {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(dados))
  } catch {
    // sem armazenamento: a partida funciona, mas não dá para voltar depois de recarregar
  }
}

export function lerParticipacao(pin) {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_LOCAL))
    return dados?.pin === pin ? dados : null
  } catch {
    return null
  }
}

export function esquecerParticipacao() {
  try {
    localStorage.removeItem(CHAVE_LOCAL)
  } catch {
    // nada a fazer
  }
}

/** Endereço do WebSocket: o professor usa o token de acesso; o estudante, a chave da participação. */
export function enderecoDaPartida(pin, { chave } = {}) {
  const protocolo = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const consulta = chave ? `chave=${encodeURIComponent(chave)}` : `token=${encodeURIComponent(obterTokens()?.access ?? '')}`
  return `${protocolo}://${window.location.host}/ws/partidas/${pin}/?${consulta}`
}

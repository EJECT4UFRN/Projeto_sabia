import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Rotas } from '../App'
import ProvedorSessao from '../sessao/ProvedorSessao'

export const ESTUDANTE = {
  id: 1,
  username: 'AllexThierry',
  nome: 'AllexThierry',
  email: 'allex@exemplo.com',
  perfil: 'estudante',
  cor_avatar: 'amarelo',
  iniciais: 'AL',
}

export const PROFESSOR = { ...ESTUDANTE, id: 2, username: 'prof', nome: 'Állex Thierry', perfil: 'professor', iniciais: 'ÁT' }

function respostaJson(status, corpo) {
  return Promise.resolve(
    new Response(status === 204 ? null : JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function lerCorpo(corpo) {
  if (!corpo) return undefined
  if (corpo instanceof FormData) return Object.fromEntries(corpo.entries())
  return JSON.parse(corpo)
}

/**
 * Substitui o fetch por respostas fixas por rota.
 * `rotas` mapeia "MÉTODO /caminho" (com ou sem a query string) para [status, corpo] ou para uma
 * função (corpoEnviado, consulta) => [status, corpo]. Cada chamada fica registrada com
 * { metodo, caminho, consulta, corpo, formulario }.
 */
export function simularApi(rotas = {}) {
  const chamadas = []
  globalThis.fetch = vi.fn((url, opcoes = {}) => {
    const metodo = opcoes.method ?? 'GET'
    const completo = String(url).replace(/^\/api/, '')
    const [caminho, textoConsulta = ''] = completo.split('?')
    const consulta = Object.fromEntries(new URLSearchParams(textoConsulta))
    const corpo = lerCorpo(opcoes.body)
    const formulario = opcoes.body instanceof FormData ? opcoes.body : undefined
    chamadas.push({ metodo, caminho, consulta, corpo, formulario, cabecalhos: opcoes.headers })
    const resposta = rotas[`${metodo} ${completo}`] ?? rotas[`${metodo} ${caminho}`]
    if (!resposta) return respostaJson(404, { detail: `Rota não simulada: ${metodo} ${completo}` })
    const [status, dados] = typeof resposta === 'function' ? resposta(corpo, consulta) : resposta
    return respostaJson(status, dados)
  })
  return chamadas
}

/** Deixa um usuário "logado" como se tivesse entrado numa visita anterior. */
export function logarComo(usuario, rotasExtras = {}) {
  sessionStorage.setItem(
    'sabia.tokens',
    JSON.stringify({ access: 'token-acesso', refresh: 'token-renovacao', manterConectado: false }),
  )
  return simularApi({ 'GET /auth/eu/': [200, usuario], 'POST /auth/sair/': [204, null], ...rotasExtras })
}

export function renderizarApp(rota) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <ProvedorSessao>
        <Rotas />
      </ProvedorSessao>
    </MemoryRouter>,
  )
}

/**
 * Troca o WebSocket do navegador por um falso. Devolve a lista de conexões abertas; cada uma tem
 * `enviadas` (o que a tela mandou) e `receber(objeto)` (simula uma mensagem do servidor).
 */
export function simularWebSocket() {
  const conexoes = []
  class WebSocketFalso {
    static OPEN = 1
    constructor(url) {
      this.url = url
      this.readyState = 0
      this.enviadas = []
      conexoes.push(this)
      queueMicrotask(() => {
        this.readyState = 1
        this.onopen?.()
      })
    }
    send(texto) {
      this.enviadas.push(JSON.parse(texto))
    }
    close() {
      this.readyState = 3
    }
    receber(objeto) {
      this.onmessage?.({ data: JSON.stringify(objeto) })
    }
    fechar(code) {
      this.readyState = 3
      this.onclose?.({ code })
    }
  }
  globalThis.WebSocket = WebSocketFalso
  return conexoes
}

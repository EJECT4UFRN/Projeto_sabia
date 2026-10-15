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
  cor_avatar: 'laranja_sinergy',
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

/**
 * Substitui o fetch por respostas fixas por rota.
 * `rotas` mapeia "MÉTODO /caminho" para [status, corpo] ou para uma função (corpoEnviado) => [status, corpo].
 */
export function simularApi(rotas = {}) {
  const chamadas = []
  globalThis.fetch = vi.fn((url, opcoes = {}) => {
    const metodo = opcoes.method ?? 'GET'
    const caminho = String(url).replace(/^\/api/, '')
    const corpo = opcoes.body ? JSON.parse(opcoes.body) : undefined
    chamadas.push({ metodo, caminho, corpo, cabecalhos: opcoes.headers })
    const resposta = rotas[`${metodo} ${caminho}`]
    if (!resposta) return respostaJson(404, { detail: `Rota não simulada: ${metodo} ${caminho}` })
    const [status, dados] = typeof resposta === 'function' ? resposta(corpo) : resposta
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

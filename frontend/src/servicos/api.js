import { atualizarTokens, limparTokens, obterTokens } from './armazenamentoTokens'

const BASE = '/api'

/** Erro da API com as mensagens por campo vindas do DRF. */
export class ErroApi extends Error {
  constructor(status, dados) {
    super(mensagemGeral(status, dados))
    this.status = status
    this.campos = dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {}
  }

  /** Primeira mensagem de um campo, para exibir embaixo do input. */
  doCampo(nome) {
    const valor = this.campos[nome]
    return Array.isArray(valor) ? valor[0] : valor
  }
}

function mensagemGeral(status, dados) {
  if (status === 0) return 'Não foi possível conectar ao Sabiá. Verifique sua internet e tente de novo.'
  if (status === 429) return 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.'
  if (dados?.non_field_errors) return dados.non_field_errors[0]
  if (dados?.detail) return dados.detail
  if (status >= 500) return 'O Sabiá teve um problema ao processar seu pedido. Tente de novo em instantes.'
  return 'Confira os campos destacados.'
}

let renovacaoEmAndamento = null

async function renovarAccess() {
  const tokens = obterTokens()
  if (!tokens?.refresh) return false
  // Várias chamadas podem expirar ao mesmo tempo; todas esperam a mesma renovação.
  renovacaoEmAndamento ??= fetch(`${BASE}/auth/renovar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: tokens.refresh }),
  })
    .then(async (resposta) => {
      if (!resposta.ok) return false
      atualizarTokens(await resposta.json())
      return true
    })
    .catch(() => false)
    .finally(() => {
      renovacaoEmAndamento = null
    })
  return renovacaoEmAndamento
}

/**
 * Chamada à API do Sabiá.
 * Envia o token de acesso quando existe e, se ele expirou, renova uma vez e repete a chamada.
 */
export async function api(caminho, { metodo = 'GET', corpo, autenticar = true, jaRenovou = false } = {}) {
  const cabecalhos = { Accept: 'application/json' }
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json'
  const tokens = obterTokens()
  if (autenticar && tokens?.access) cabecalhos.Authorization = `Bearer ${tokens.access}`

  let resposta
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    })
  } catch {
    throw new ErroApi(0, null)
  }

  if (resposta.status === 401 && autenticar && tokens?.refresh && !jaRenovou) {
    if (await renovarAccess()) return api(caminho, { metodo, corpo, autenticar, jaRenovou: true })
    limparTokens()
  }

  const dados = resposta.status === 204 ? null : await resposta.json().catch(() => null)
  if (!resposta.ok) throw new ErroApi(resposta.status, dados)
  return dados
}

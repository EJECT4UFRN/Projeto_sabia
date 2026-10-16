import { api } from './api'

/** Monta a query string ignorando filtros vazios. */
function parametros(filtros = {}) {
  const busca = new URLSearchParams()
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, valor)
  })
  const texto = busca.toString()
  return texto ? `?${texto}` : ''
}

export const listarPerguntas = (filtros) => api(`/perguntas/${parametros(filtros)}`)

export const buscarPergunta = (id) => api(`/perguntas/${id}/`)

/**
 * Cria ou atualiza a pergunta. Com imagem nova (ou pedido de remoção) os dados vão como
 * formulário multipart; sem arquivo, vão como JSON.
 */
export function salvarPergunta(id, dados, { imagem, removerImagem } = {}) {
  const caminho = id ? `/perguntas/${id}/` : '/perguntas/'
  const metodo = id ? 'PATCH' : 'POST'

  if (!imagem && !removerImagem) return api(caminho, { metodo, corpo: dados })

  const formulario = new FormData()
  Object.entries(dados).forEach(([chave, valor]) => {
    formulario.append(chave, valor === null || valor === undefined ? '' : String(valor))
  })
  if (imagem) formulario.append('imagem', imagem)
  if (removerImagem) formulario.append('remover_imagem', 'true')
  return api(caminho, { metodo, corpo: formulario })
}

export const excluirPergunta = (id) => api(`/perguntas/${id}/`, { metodo: 'DELETE' })

export const listarCategorias = () => api('/categorias/')

export const criarCategoria = (nome) => api('/categorias/', { metodo: 'POST', corpo: { nome } })

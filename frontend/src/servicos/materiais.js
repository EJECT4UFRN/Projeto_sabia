import { api } from './api'
import { parametros } from './perguntas'

// Painel do professor
export const listarMateriais = (filtros) => api(`/materiais/${parametros(filtros)}`)
export const resumoMateriais = () => api('/materiais/resumo/')
export const buscarMaterial = (id) => api(`/materiais/${id}/`)
export const excluirMaterial = (id) => api(`/materiais/${id}/`, { metodo: 'DELETE' })
export const mudarStatusMaterial = (id, status) =>
  api(`/materiais/${id}/`, { metodo: 'PATCH', corpo: { status } })

/**
 * Cria ou edita o material. Vai como multipart para levar o arquivo e a capa.
 * `dados.turmas_ids` é uma lista de ids; vira o texto "1,2,3" que o backend espera.
 */
export function salvarMaterial(id, dados, { arquivo, capa, removerCapa } = {}) {
  const corpo = new FormData()
  Object.entries(dados).forEach(([campo, valor]) => {
    if (valor === undefined || valor === null) return
    corpo.append(campo, campo === 'turmas_ids' ? valor.join(',') : String(valor))
  })
  if (arquivo) corpo.append('arquivo', arquivo)
  if (capa) corpo.append('capa', capa)
  if (removerCapa) corpo.append('remover_capa', 'true')
  return api(id ? `/materiais/${id}/` : '/materiais/', { metodo: id ? 'PATCH' : 'POST', corpo })
}

// "Continue aprendendo" (estudante ou visitante)
export const listarEstudo = (filtros) => api(`/estudo/${parametros(filtros)}`)
export const buscarEstudo = (id) => api(`/estudo/${id}/`)
export const marcarConcluido = (id, concluido) =>
  api(`/estudo/${id}/concluir/`, { metodo: concluido ? 'POST' : 'DELETE' })

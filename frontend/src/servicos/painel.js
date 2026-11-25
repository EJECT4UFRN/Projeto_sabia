import { api } from './api'
import { parametros } from './perguntas'

export const buscarPainel = () => api('/painel/')
export const buscarNoPainel = (q) => api(`/painel/busca/${parametros({ q })}`)
export const listarPartidas = (filtros) => api(`/partidas/${parametros(filtros)}`)
export const buscarRelatorio = (id) => api(`/partidas/${id}/relatorio/`)

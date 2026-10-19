import { api } from './api'

export const listarHistorico = (pagina = 1) => api(`/historico/${pagina > 1 ? `?pagina=${pagina}` : ''}`)

export const buscarResumoPartida = (id) => api(`/historico/${id}/`)

export const retomarPartida = (id) => api(`/historico/${id}/retomar/`, { metodo: 'POST' })

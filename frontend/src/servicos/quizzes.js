import { api } from './api'
import { corpoPergunta, parametros } from './perguntas'

export const listarQuizzes = (filtros) => api(`/quizzes/${parametros(filtros)}`)

export const buscarQuiz = (id) => api(`/quizzes/${id}/`)

export const salvarQuiz = (id, dados) =>
  api(id ? `/quizzes/${id}/` : '/quizzes/', { metodo: id ? 'PATCH' : 'POST', corpo: dados })

export const excluirQuiz = (id) => api(`/quizzes/${id}/`, { metodo: 'DELETE' })

export const duplicarQuiz = (id) => api(`/quizzes/${id}/duplicar/`, { metodo: 'POST' })

/** Lápis dentro do quiz: a mudança vale só para este quiz (o backend cria uma cópia se preciso). */
export const editarPerguntaNoQuiz = (quizId, perguntaId, dados, arquivos) =>
  api(`/quizzes/${quizId}/perguntas/${perguntaId}/`, { metodo: 'PATCH', corpo: corpoPergunta(dados, arquivos) })

import { api } from './api'
import { parametros } from './perguntas'

// Disciplinas do professor (usadas nos quizzes e nos materiais)
export const listarDisciplinas = () => api('/disciplinas/')
export const criarDisciplina = (nome) => api('/disciplinas/', { metodo: 'POST', corpo: { nome } })

// Turmas do professor
export const listarTurmas = () => api('/turmas/')
export const buscarTurma = (id) => api(`/turmas/${id}/`)
export const salvarTurma = (id, dados) =>
  api(id ? `/turmas/${id}/` : '/turmas/', { metodo: id ? 'PATCH' : 'POST', corpo: dados })
export const excluirTurma = (id) => api(`/turmas/${id}/`, { metodo: 'DELETE' })
export const adicionarAluno = (turmaId, alunoId) =>
  api(`/turmas/${turmaId}/alunos/`, { metodo: 'POST', corpo: { aluno_id: alunoId } })
export const removerAluno = (turmaId, alunoId) => api(`/turmas/${turmaId}/alunos/${alunoId}/`, { metodo: 'DELETE' })
export const gerarNovoCodigo = (turmaId) => api(`/turmas/${turmaId}/novo_codigo/`, { metodo: 'POST' })
export const buscarAlunos = (busca) => api(`/alunos/${parametros({ busca })}`)

// Turmas do estudante (no perfil)
export const listarMinhasTurmas = () => api('/minhas-turmas/')
export const entrarNaTurma = (codigo) => api('/minhas-turmas/entrar/', { metodo: 'POST', corpo: { codigo } })
export const sairDaTurma = (id) => api(`/minhas-turmas/${id}/`, { metodo: 'DELETE' })

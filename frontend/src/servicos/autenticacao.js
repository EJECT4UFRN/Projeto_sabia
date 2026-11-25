import { api } from './api'

export const entrar = (login, senha) =>
  api('/auth/entrar/', { metodo: 'POST', corpo: { login, senha }, autenticar: false })

export const cadastrar = (dados) => api('/auth/cadastro/', { metodo: 'POST', corpo: dados, autenticar: false })

export const buscarUsuarioLogado = () => api('/auth/eu/')

export const sair = (refresh) => api('/auth/sair/', { metodo: 'POST', corpo: { refresh } })

export const pedirRedefinicaoDeSenha = (login) =>
  api('/auth/esqueci-senha/', { metodo: 'POST', corpo: { login }, autenticar: false })

export const redefinirSenha = (dados) =>
  api('/auth/redefinir-senha/', { metodo: 'POST', corpo: dados, autenticar: false })

export const atualizarPerfil = (dados) => api('/auth/eu/', { metodo: 'PATCH', corpo: dados })

export const alterarSenha = (dados) => api('/auth/alterar-senha/', { metodo: 'POST', corpo: dados })

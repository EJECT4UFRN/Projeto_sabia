import { createContext, useContext } from 'react'

export const ContextoSessao = createContext(null)

/** Dados e ações da sessão: { usuario, carregando, entrar, cadastrar, sair }. */
export function useSessao() {
  const sessao = useContext(ContextoSessao)
  if (!sessao) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>.')
  return sessao
}

/** Para onde mandar a pessoa depois de entrar, conforme o perfil. */
export function paginaInicialDoPerfil(usuario) {
  return usuario?.perfil === 'professor' ? '/adm' : '/jogar'
}

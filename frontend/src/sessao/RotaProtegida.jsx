import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Carregando from '../componentes/estados/Carregando'
import { paginaInicialDoPerfil, useSessao } from './contexto'

/**
 * Libera as rotas filhas só para quem está logado (e, se `perfil` for passado, só para esse perfil).
 * Quem não está logado vai para a tela de entrar e volta para cá depois.
 */
export default function RotaProtegida({ perfil, telaDeEntrar = '/entrar' }) {
  const { usuario, carregando } = useSessao()
  const local = useLocation()

  if (carregando) return <Carregando />
  if (!usuario) return <Navigate to={telaDeEntrar} replace state={{ voltarPara: local.pathname }} />
  if (perfil && usuario.perfil !== perfil) return <Navigate to={paginaInicialDoPerfil(usuario)} replace />
  return <Outlet />
}

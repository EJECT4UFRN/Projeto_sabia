import { NavLink } from 'react-router-dom'
import { IconeHistorico, IconeJogar, IconeMateriais, IconePerfil } from '../icones/Icones'
import estilos from './BarraInferior.module.css'

const itens = [
  { para: '/jogar', rotulo: 'Jogar', Icone: IconeJogar },
  { para: '/historico', rotulo: 'Histórico', Icone: IconeHistorico },
  { para: '/perfil', rotulo: 'Perfil', Icone: IconePerfil },
  { para: '/materiais', rotulo: 'Materiais', Icone: IconeMateriais },
]

/** Barra de navegação fixa no rodapé, só no mobile, para o estudante logado. */
export default function BarraInferior() {
  return (
    <nav className={estilos.barra} aria-label="Navegação do estudante">
      <ul className={estilos.lista}>
        {itens.map(({ para, rotulo, Icone }) => (
          <li key={para}>
            <NavLink to={para} className={({ isActive }) => `${estilos.item} ${isActive ? estilos.ativo : ''}`}>
              <Icone />
              <span>{rotulo}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

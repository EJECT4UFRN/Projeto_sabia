import { NavLink } from 'react-router-dom'
import { IconeDashboard, IconeMateriaisAdm, IconePerguntas, IconeQuiz } from '../icones/Icones'
import estilos from './BarraInferiorAdm.module.css'

const itens = [
  { para: '/adm', rotulo: 'Dashboard', Icone: IconeDashboard, exato: true },
  { para: '/adm/perguntas', rotulo: 'Perguntas', Icone: IconePerguntas },
  { para: '/adm/materiais', rotulo: 'Materiais', Icone: IconeMateriaisAdm },
  { para: '/adm/quiz', rotulo: 'Quiz', Icone: IconeQuiz },
]

/** Navegação do painel no celular (mockup "Footer" do painel administrativo). */
export default function BarraInferiorAdm() {
  return (
    <nav className={estilos.barra} aria-label="Navegação do painel">
      <ul className={estilos.lista}>
        {itens.map(({ para, rotulo, Icone, exato }) => (
          <li key={para}>
            <NavLink
              to={para}
              end={exato}
              className={({ isActive }) => `${estilos.item} ${isActive ? estilos.ativo : ''}`}
            >
              <span className={estilos.icone}>
                <Icone />
              </span>
              <span>{rotulo}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

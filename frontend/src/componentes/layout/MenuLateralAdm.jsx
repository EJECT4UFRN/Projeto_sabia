import { NavLink } from 'react-router-dom'
import { IconeDashboard, IconeMateriaisAdm, IconePerguntas, IconeQuiz, IconeSair } from '../icones/Icones'
import Logo from '../marca/Logo'
import estilos from './MenuLateralAdm.module.css'

const itens = [
  { para: '/adm', rotulo: 'Dashboard', Icone: IconeDashboard, exato: true },
  { para: '/adm/perguntas', rotulo: 'Perguntas', Icone: IconePerguntas },
  { para: '/adm/quiz', rotulo: 'Quiz', Icone: IconeQuiz },
  { para: '/adm/materiais', rotulo: 'Materiais', Icone: IconeMateriaisAdm },
]

export default function MenuLateralAdm({ aberto, aoSair, aoNavegar }) {
  return (
    <aside className={`${estilos.menu} ${aberto ? estilos.aberto : ''}`} aria-label="Menu do painel administrativo">
      <div className={estilos.topo}>
        <Logo variante="laranja" largura={83} posicao="lado" corTexto="branco" subtitulo="PAINEL ADMINISTRATIVO" />
      </div>

      <nav className={estilos.navegacao}>
        {itens.map(({ para, rotulo, Icone, exato }) => (
          <NavLink
            key={para}
            to={para}
            end={exato}
            onClick={aoNavegar}
            className={({ isActive }) => `${estilos.item} ${isActive ? estilos.ativo : ''}`}
          >
            <span className={estilos.icone}>
              <Icone />
            </span>
            {rotulo}
          </NavLink>
        ))}
      </nav>

      <div className={estilos.rodape}>
        <button type="button" className={`${estilos.item} ${estilos.sair}`} onClick={aoSair}>
          <span className={estilos.icone}>
            <IconeSair />
          </span>
          Sair
        </button>
      </div>
    </aside>
  )
}

import { Outlet } from 'react-router-dom'
import BarraInferior from './BarraInferior'
import CabecalhoEstudante from './CabecalhoEstudante'
import estilos from './LayoutEstudante.module.css'

/** Estrutura das telas do estudante: cabeçalho no topo e, no mobile logado, barra inferior. */
export default function LayoutEstudante({ comBarraInferior = false, aoSair }) {
  return (
    <div className={`${estilos.layout} ${comBarraInferior ? estilos.comBarra : ''}`}>
      <CabecalhoEstudante aoSair={aoSair} />
      <main className={estilos.conteudo}>
        <Outlet />
      </main>
      {comBarraInferior && <BarraInferior />}
    </div>
  )
}

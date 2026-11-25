import { DIFICULDADES } from './dificuldades'
import estilos from './Selos.module.css'

const rotuloDificuldade = Object.fromEntries(DIFICULDADES.map(({ valor, rotulo }) => [valor, rotulo]))

export function SeloCategoria({ children }) {
  return <span className={estilos.categoria}>{children}</span>
}

export function Dificuldade({ valor }) {
  return (
    <span className={estilos.dificuldade}>
      <span className={`${estilos.ponto} ${estilos[`ponto-${valor}`]}`} aria-hidden="true" />
      {rotuloDificuldade[valor] ?? valor}
    </span>
  )
}

export function SeloStatus({ ativa }) {
  return (
    <span className={`${estilos.status} ${ativa ? estilos.ativa : estilos.inativa}`}>
      <span className={estilos.pontoStatus} aria-hidden="true" />
      {ativa ? 'Ativa' : 'Inativa'}
    </span>
  )
}

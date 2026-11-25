import estilos from './Carregando.module.css'

export default function Carregando({ texto = 'Carregando…' }) {
  return (
    <div className={estilos.carregando} role="status" aria-live="polite">
      <span className={estilos.indicador} aria-hidden="true" />
      <span>{texto}</span>
    </div>
  )
}

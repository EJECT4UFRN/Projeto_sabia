import estilos from './Formulario.module.css'

export default function CaixaSelecao({ rotulo, ...props }) {
  return (
    <label className={estilos.caixaSelecao}>
      <input type="checkbox" className={estilos.checkbox} {...props} />
      <span>{rotulo}</span>
    </label>
  )
}

import estilos from './Formulario.module.css'

/** Mensagem no topo do formulário (erro geral ou confirmação de sucesso). */
export default function Alerta({ tipo = 'erro', children }) {
  if (!children) return null
  return (
    <div className={`${estilos.alerta} ${estilos[`alerta-${tipo}`]}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

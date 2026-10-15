import { avaliarSenha } from './forcaSenha'
import estilos from './Formulario.module.css'

export default function MedidorForcaSenha({ senha }) {
  const { rotulo, percentual, cor } = avaliarSenha(senha)
  if (!senha) return null

  return (
    <div className={estilos.medidor}>
      <div className={estilos.trilho} aria-hidden="true">
        <div className={estilos.barra} style={{ width: `${percentual}%`, background: cor }} />
      </div>
      <p className={estilos.textoMedidor} style={{ color: cor }} aria-live="polite">
        <span className="visualmente-oculto">Força da senha: </span>
        {rotulo}
      </p>
    </div>
  )
}

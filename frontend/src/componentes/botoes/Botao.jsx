import { Link } from 'react-router-dom'
import estilos from './Botao.module.css'

/**
 * Botão padrão do Sabiá.
 * variante "primario": gradiente laranja→amarelo com sombra sólida (Entrar com PIN)
 * variante "secundario": contorno laranja (Jogar agora)
 * Passe `para` para renderizar como link de rota.
 */
export default function Botao({ variante = 'primario', para, icone, children, className = '', ...resto }) {
  const classes = [estilos.botao, estilos[variante], className].join(' ').trim()
  const conteudo = (
    <>
      {icone && <span className={estilos.icone}>{icone}</span>}
      <span>{children}</span>
    </>
  )

  if (para) {
    return (
      <Link to={para} className={classes} {...resto}>
        {conteudo}
      </Link>
    )
  }

  return (
    <button type="button" className={classes} {...resto}>
      {conteudo}
    </button>
  )
}

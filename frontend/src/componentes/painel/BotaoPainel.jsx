import { Link } from 'react-router-dom'
import estilos from './BotaoPainel.module.css'

/**
 * Botões do painel.
 * "primario": laranja com sombra sólida (Adicionar pergunta, Salvar alterações)
 * "escuro": azul (Filtrar)
 * "contorno": borda azul-clara (Cancelar)
 * "perigo": vermelho (confirmar exclusão)
 */
export default function BotaoPainel({ variante = 'primario', para, icone, children, className = '', ...resto }) {
  const classes = `${estilos.botao} ${estilos[variante]} ${className}`
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

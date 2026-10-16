import { IconeSetaSelecao } from '../icones/Icones'
import estilos from './Selecao.module.css'

/** <select> nativo com o visual do painel (fundo azul-claro, seta cinza). */
export default function Selecao({ children, compacto = false, className = '', ...props }) {
  return (
    <div className={`${estilos.caixa} ${compacto ? estilos.compacto : ''} ${className}`}>
      <select className={estilos.select} {...props}>
        {children}
      </select>
      <span className={estilos.seta}>
        <IconeSetaSelecao />
      </span>
    </div>
  )
}

import { IconeSetaDireita } from '../icones/Icones'
import estilos from './Paginacao.module.css'

/** Até 3 números de página visíveis em volta da atual, com setas de anterior/próxima. */
function paginasVisiveis(pagina, total) {
  const inicio = Math.max(1, Math.min(pagina - 1, total - 2))
  return Array.from({ length: Math.min(3, total) }, (_, i) => inicio + i)
}

export default function Paginacao({ pagina, totalPaginas, aoMudar }) {
  if (totalPaginas <= 1) return null

  return (
    <nav aria-label="Paginação" className={estilos.paginacao}>
      {pagina > 1 && (
        <button
          type="button"
          className={`${estilos.botao} ${estilos.anterior}`}
          aria-label="Página anterior"
          onClick={() => aoMudar(pagina - 1)}
        >
          <IconeSetaDireita />
        </button>
      )}
      {paginasVisiveis(pagina, totalPaginas).map((numero) => (
        <button
          key={numero}
          type="button"
          className={`${estilos.botao} ${numero === pagina ? estilos.atual : ''}`}
          aria-label={`Página ${numero}`}
          aria-current={numero === pagina ? 'page' : undefined}
          onClick={() => aoMudar(numero)}
        >
          {numero}
        </button>
      ))}
      {pagina < totalPaginas && (
        <button
          type="button"
          className={estilos.botao}
          aria-label="Próxima página"
          onClick={() => aoMudar(pagina + 1)}
        >
          <IconeSetaDireita />
        </button>
      )}
    </nav>
  )
}

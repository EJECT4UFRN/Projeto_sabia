import { useEffect, useId, useRef } from 'react'
import { IconeFechar } from '../icones/Icones'
import estilos from './Modal.module.css'

/**
 * Janela sobreposta no estilo do mockup ("Nova pergunta"): sobretítulo laranja, título,
 * descrição e botão de fechar. Fecha com Esc ou clicando fora; o foco vai para dentro dela.
 */
export default function Modal({ aberto, aoFechar, sobretitulo, titulo, descricao, children, rodape, largura = 520 }) {
  const idTitulo = useId()
  const caixaRef = useRef(null)

  useEffect(() => {
    if (!aberto) return undefined
    const focoAnterior = document.activeElement
    const primeiro = caixaRef.current?.querySelector('input, select, textarea, button:not([data-fechar])')
    ;(primeiro ?? caixaRef.current)?.focus()

    function aoApertarTecla(evento) {
      if (evento.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoApertarTecla)
    return () => {
      document.removeEventListener('keydown', aoApertarTecla)
      focoAnterior?.focus?.()
    }
  }, [aberto, aoFechar])

  if (!aberto) return null

  return (
    <div className={estilos.fundo} onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div
        ref={caixaRef}
        className={estilos.caixa}
        style={{ maxWidth: largura }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
      >
        <header className={estilos.cabecalho}>
          <div>
            {sobretitulo && <p className={estilos.sobretitulo}>{sobretitulo}</p>}
            <h2 id={idTitulo} className={estilos.titulo}>
              {titulo}
            </h2>
            {descricao && <p className={estilos.descricao}>{descricao}</p>}
          </div>
          <button type="button" className={estilos.fechar} aria-label="Fechar" data-fechar onClick={aoFechar}>
            <IconeFechar />
          </button>
        </header>
        <div className={estilos.corpo}>{children}</div>
        {rodape && <footer className={estilos.rodape}>{rodape}</footer>}
      </div>
    </div>
  )
}

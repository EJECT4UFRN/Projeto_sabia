import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { IconeSetaMigalha } from '../icones/Icones'
import estilos from './CabecalhoPagina.module.css'

/**
 * Topo das telas do painel: migalhas ou sobretítulo laranja, título, descrição e uma ação à direita.
 * `migalhas` é uma lista de { rotulo, para }; a última é a página atual (sem link).
 */
export default function CabecalhoPagina({ migalhas = [], sobretitulo, titulo, descricao, children }) {
  return (
    <header className={estilos.cabecalho}>
      <div className={estilos.textos}>
        {migalhas.length > 0 && (
          <nav aria-label="Você está em">
            <ol className={estilos.migalhas}>
              {migalhas.map(({ rotulo, para }, indice) => {
                const atual = indice === migalhas.length - 1
                return (
                  <Fragment key={rotulo}>
                    {indice > 0 && (
                      <li aria-hidden="true" className={estilos.separador}>
                        <IconeSetaMigalha />
                      </li>
                    )}
                    <li>
                      {atual || !para ? (
                        <span className={estilos.atual} aria-current={atual ? 'page' : undefined}>
                          {rotulo}
                        </span>
                      ) : (
                        <Link to={para}>{rotulo}</Link>
                      )}
                    </li>
                  </Fragment>
                )
              })}
            </ol>
          </nav>
        )}
        {sobretitulo && <p className={estilos.sobretitulo}>{sobretitulo}</p>}
        <h1 className={estilos.titulo}>{titulo}</h1>
        {descricao && <p className={estilos.descricao}>{descricao}</p>}
      </div>
      {children && <div className={estilos.acao}>{children}</div>}
    </header>
  )
}

import { useState } from 'react'
import { formatarTamanho } from '../adm/materiais/tiposMaterial'
import { capaDesenhada, etiquetaCapa } from './capas'
import estilos from './CapaMaterial.module.css'

/** Capa do material: a imagem enviada (ou do YouTube) ou o desenho do tipo, com a etiqueta e o arco amarelo. */
export default function CapaMaterial({ material, grande = false }) {
  const desenho = capaDesenhada(material)
  // Se a imagem não carregar (link quebrado, sem internet para o YouTube), volta para o desenho.
  const [falhou, setFalhou] = useState(false)
  const foto = falhou ? null : material.capa_url
  return (
    <div
      className={`${estilos.capa} ${grande ? estilos.grande : ''}`}
      style={{ background: foto ? '#0a374e' : desenho.fundo }}
    >
      {foto ? (
        <img src={foto} alt="" className={estilos.foto} loading="lazy" onError={() => setFalhou(true)} />
      ) : (
        <img src={desenho.imagem} alt="" className={estilos.desenho} />
      )}
      <span className={estilos.etiqueta}>{etiquetaCapa(material, formatarTamanho)}</span>
      {!foto && <span className={estilos.arco} aria-hidden="true" />}
      {material.concluido && <span className={estilos.concluido}>✓ Concluído</span>}
    </div>
  )
}

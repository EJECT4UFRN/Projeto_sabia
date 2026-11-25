import { IconeArtigo, IconePdf, IconeVideo } from '../../../componentes/icones/Icones'

/** Os três tipos de material, com o rótulo e o ícone do mockup. */
export const TIPOS_MATERIAL = [
  { valor: 'video', rotulo: 'Vídeo', rotuloSelecao: 'Vídeo / Link do conteúdo', Icone: IconeVideo },
  { valor: 'documento', rotulo: 'PDF / Documento', rotuloSelecao: 'PDF / Documento', Icone: IconePdf },
  { valor: 'artigo', rotulo: 'Link / Artigo', rotuloSelecao: 'Link / Artigo', Icone: IconeArtigo },
]

export const tipoMaterial = (valor) => TIPOS_MATERIAL.find((tipo) => tipo.valor === valor) ?? TIPOS_MATERIAL[2]

export const formatarData = (iso) => new Date(iso).toLocaleDateString('pt-BR')

/** 2516582 → "2,4 MB" */
export function formatarTamanho(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

export const plural = (numero, singular, varios) => `${numero} ${numero === 1 ? singular : varios}`

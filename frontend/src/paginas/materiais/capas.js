import imagemPdf from '../../assets/materiais/pdf.svg'
import imagemPlay from '../../assets/materiais/play-amarelo.svg'
import imagemPrancheta from '../../assets/materiais/prancheta.svg'
import imagemReciclagem from '../../assets/materiais/reciclagem.svg'
import imagemSol from '../../assets/materiais/sol.svg'

/**
 * Capas desenhadas do mockup "Continue aprendendo", usadas quando o material não tem imagem.
 * Cada tipo tem duas, alternadas pelo id para os cartões não ficarem todos iguais.
 */
const CAPAS = {
  video: [
    { fundo: '#043c73', imagem: imagemPlay },
    { fundo: '#0a374e', imagem: imagemPlay },
  ],
  artigo: [
    { fundo: '#0787cb', imagem: imagemReciclagem },
    { fundo: '#fccc04', imagem: imagemSol },
  ],
  documento: [
    { fundo: '#fc9c14', imagem: imagemPdf },
    { fundo: '#29966f', imagem: imagemPrancheta },
  ],
}

export const capaDesenhada = (material) => {
  const opcoes = CAPAS[material.tipo] ?? CAPAS.artigo
  return opcoes[material.id % opcoes.length]
}

const ehPdf = (material) => material.extensao === 'PDF'

/** Rótulo laranja do cartão: "Vídeo", "Artigo", "PDF" ou "Documento". */
export function rotuloTipo(material) {
  if (material.tipo === 'video') return 'Vídeo'
  if (material.tipo === 'artigo') return 'Artigo'
  return ehPdf(material) ? 'PDF' : 'Documento'
}

/** Texto do botão de abrir. */
export function textoAcao(material) {
  if (material.tipo === 'video') return 'Assistir agora'
  if (material.tipo === 'artigo') return 'Ler artigo'
  return ehPdf(material) ? 'Abrir PDF' : 'Abrir documento'
}

/** Etiqueta escura sobre a capa: duração, tempo de leitura ou formato e tamanho. */
export function etiquetaCapa(material, formatarTamanho) {
  if (material.tipo === 'video') return material.duracao || 'Vídeo'
  if (material.tipo === 'artigo') return material.tempo_leitura ? `${material.tempo_leitura} min de leitura` : 'Artigo'
  const tamanho = formatarTamanho(material.tamanho)
  return [material.extensao || 'Arquivo', tamanho].filter(Boolean).join(' · ')
}

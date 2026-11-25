import {
  IconeCirculo,
  IconeDiamante,
  IconeQuadrado,
  IconeTriangulo,
} from '../../componentes/icones/Icones'

/** Cor e símbolo de cada posição de alternativa (como no Kahoot): vermelho, azul, amarelo, verde. */
export const VISUAL_ALTERNATIVAS = [
  { classe: 'vermelho', Icone: IconeTriangulo, nome: 'triângulo' },
  { classe: 'azul', Icone: IconeDiamante, nome: 'diamante' },
  { classe: 'amarelo', Icone: IconeCirculo, nome: 'círculo' },
  { classe: 'verde', Icone: IconeQuadrado, nome: 'quadrado' },
]

export const formatarPontos = (valor) => Number(valor ?? 0).toLocaleString('pt-BR')

export const formatarPin = (pin) => (pin ? `${pin.slice(0, 3)} ${pin.slice(3)}` : '')

export const formatarSegundos = (valor) =>
  valor === null || valor === undefined ? '—' : `${String(valor).replace('.', ',')} s`

export const ordinal = (posicao) => (posicao ? `${posicao}º` : '—')

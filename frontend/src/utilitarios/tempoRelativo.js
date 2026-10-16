const formatador = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'always' })

const UNIDADES = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
]

/** "2 dias atrás", "1 semana atrás"… (formato do mockup) a partir de uma data ISO. */
export function tempoRelativo(dataIso, agora = new Date()) {
  const segundos = Math.round((new Date(dataIso) - agora) / 1000)
  for (const [unidade, tamanho] of UNIDADES) {
    if (Math.abs(segundos) >= tamanho) {
      // O Intl escreve "há 2 dias"; o mockup usa "2 dias atrás".
      return formatador.format(Math.round(segundos / tamanho), unidade).replace(/^há (.+)$/, '$1 atrás')
    }
  }
  return 'agora mesmo'
}

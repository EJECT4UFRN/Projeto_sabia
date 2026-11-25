// Mesmas regras do backend, para avisar antes de enviar. O backend continua sendo quem decide.
export const LETRAS = ['a', 'b', 'c', 'd']
export const LIMITES = {
  tempo: { min: 5, max: 300, padrao: 20 },
  pontuacao: { min: 100, max: 2000, padrao: 1000 },
}

const normalizar = (texto) => texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')

export function validarPergunta(dados) {
  const erros = {}
  if (!dados.texto.trim()) erros.texto = 'Escreva o texto da pergunta.'

  const vistos = new Map()
  LETRAS.forEach((letra) => {
    const campo = `alternativa_${letra}`
    const texto = normalizar(dados[campo])
    if (!texto) {
      erros[campo] = 'Preencha esta alternativa.'
      return
    }
    if (vistos.has(texto)) erros[campo] = 'Esta alternativa repete outra. Cada opção precisa ser diferente.'
    else vistos.set(texto, campo)
  })

  if (!dados.resposta_correta) erros.resposta_correta = 'Marque qual alternativa é a correta.'

  const tempo = Number(dados.tempo_limite)
  if (!Number.isInteger(tempo) || tempo < LIMITES.tempo.min || tempo > LIMITES.tempo.max) {
    erros.tempo_limite = `Use um tempo entre ${LIMITES.tempo.min} e ${LIMITES.tempo.max} segundos.`
  }
  const pontuacao = Number(dados.pontuacao_maxima)
  if (!Number.isInteger(pontuacao) || pontuacao < LIMITES.pontuacao.min || pontuacao > LIMITES.pontuacao.max) {
    erros.pontuacao_maxima = `Use uma pontuação entre ${LIMITES.pontuacao.min} e ${LIMITES.pontuacao.max}.`
  }
  return erros
}

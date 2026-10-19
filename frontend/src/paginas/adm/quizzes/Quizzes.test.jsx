import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { logarComo, PROFESSOR, renderizarApp } from '../../../testes/auxiliares'

const QUIZ_PUBLICADO = {
  id: 1,
  titulo: 'Sistema Solar',
  disciplina: 'Ciências',
  turma: '',
  dificuldade: 'medio',
  status: 'publicado',
  favorito: true,
  perguntas_total: 10,
  partidas_realizadas: 0,
  atualizado_em: '2026-09-02T12:00:00Z',
}
const QUIZ_RASCUNHO = { ...QUIZ_PUBLICADO, id: 2, titulo: 'Reciclagem', status: 'rascunho', favorito: false, perguntas_total: 0 }

const pagina = (results, count = results.length) => ({ count, results })

const pergunta = (id, texto, extras = {}) => ({
  id,
  texto,
  alternativa_a: 'Marte',
  alternativa_b: 'Vênus',
  alternativa_c: 'Júpiter',
  alternativa_d: 'Saturno',
  resposta_correta: 'A',
  tempo_limite: 20,
  pontuacao_maxima: 1000,
  imagem: null,
  no_banco: true,
  ...extras,
})

const P1 = pergunta(11, 'Qual planeta é vermelho?')
const P2 = pergunta(12, 'Qual o maior planeta?')

function quizCompleto(extras = {}) {
  return {
    id: 1,
    titulo: 'Sistema Solar',
    descricao: '',
    disciplina: 'Ciências',
    turma: '8º ano A',
    dificuldade: 'medio',
    tempo_padrao: 20,
    pontuacao_padrao: 1000,
    embaralhar_perguntas: false,
    embaralhar_respostas: false,
    status: 'publicado',
    favorito: false,
    perguntas: [P1, P2],
    perguntas_total: 2,
    pode_iniciar: true,
    atualizado_em: '2026-09-02T12:00:00Z',
    ...extras,
  }
}

const rotasBase = {
  'GET /quizzes/disciplinas/': [200, ['Ciências']],
  'GET /perguntas/': [200, pagina([P1, P2])],
}

describe('Meus jogos', () => {
  it('lista os quizzes com status, detalhes e contagem', async () => {
    logarComo(PROFESSOR, { ...rotasBase, 'GET /quizzes/': [200, pagina([QUIZ_PUBLICADO, QUIZ_RASCUNHO], 8)] })
    renderizarApp('/adm/quiz')

    expect(await screen.findByRole('heading', { name: 'Sistema Solar' })).toBeInTheDocument()
    expect(screen.getByText('Publicado')).toBeInTheDocument()
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
    expect(screen.getByText(/Ciências · 10 perguntas · Médio/)).toBeInTheDocument()
    expect(screen.getAllByText('02/09/2026')).toHaveLength(2)
    expect(screen.getByText(/Exibindo/)).toHaveTextContent('Exibindo 2 de 8 jogos')
    expect(screen.getByRole('button', { name: 'Favorito: Sistema Solar' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('só deixa iniciar partida de quiz publicado com perguntas', async () => {
    logarComo(PROFESSOR, { ...rotasBase, 'GET /quizzes/': [200, pagina([QUIZ_PUBLICADO, QUIZ_RASCUNHO])] })
    renderizarApp('/adm/quiz')

    expect(await screen.findByRole('link', { name: 'Iniciar partida: Sistema Solar' })).toHaveAttribute(
      'href',
      '/adm/quiz/1/partida',
    )
    expect(screen.queryByRole('link', { name: 'Iniciar partida: Reciclagem' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Publique para iniciar: Reciclagem' })).toBeInTheDocument()
  })

  it('mostra o estado vazio com atalho para criar', async () => {
    logarComo(PROFESSOR, { ...rotasBase, 'GET /quizzes/': [200, pagina([])] })
    renderizarApp('/adm/quiz')

    expect(await screen.findByText('Você ainda não tem quizzes')).toBeInTheDocument()
  })

  it('mostra erro com opção de tentar de novo', async () => {
    logarComo(PROFESSOR, { ...rotasBase, 'GET /quizzes/': [500, {}] })
    renderizarApp('/adm/quiz')

    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('filtra por status, favoritos e dificuldade', async () => {
    const usuario = userEvent.setup()
    const chamadas = logarComo(PROFESSOR, { ...rotasBase, 'GET /quizzes/': [200, pagina([QUIZ_PUBLICADO])] })
    renderizarApp('/adm/quiz')
    await screen.findByRole('heading', { name: 'Sistema Solar' })

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'favoritos')
    await waitFor(() =>
      expect(chamadas.at(-1).consulta).toEqual(expect.objectContaining({ favorito: 'true' })),
    )
    expect(chamadas.at(-1).consulta.status).toBeUndefined()

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Dificuldade' }), 'dificil')
    await waitFor(() =>
      expect(chamadas.at(-1).consulta).toEqual(expect.objectContaining({ dificuldade: 'dificil', favorito: 'true' })),
    )
  })

  it('favorita, duplica e exclui', async () => {
    const usuario = userEvent.setup()
    const chamadas = logarComo(PROFESSOR, {
      ...rotasBase,
      'GET /quizzes/': [200, pagina([QUIZ_RASCUNHO])],
      'PATCH /quizzes/2/': [200, {}],
      'POST /quizzes/2/duplicar/': [201, { ...QUIZ_RASCUNHO, id: 3, titulo: 'Reciclagem (cópia)' }],
      'DELETE /quizzes/2/': [204, null],
    })
    renderizarApp('/adm/quiz')

    await usuario.click(await screen.findByRole('button', { name: 'Favorito: Reciclagem' }))
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'PATCH' && c.corpo.favorito === true)).toBe(true))

    await usuario.click(screen.getByRole('button', { name: 'Duplicar: Reciclagem' }))
    expect(await screen.findByText('Quiz duplicado: “Reciclagem (cópia)”.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Excluir: Reciclagem' }))
    const modal = screen.getByRole('dialog', { name: 'Excluir quiz?' })
    await usuario.click(within(modal).getByRole('button', { name: 'Excluir quiz' }))
    expect(await screen.findByText('Quiz excluído.')).toBeInTheDocument()
    expect(chamadas.some((c) => c.metodo === 'DELETE' && c.caminho === '/quizzes/2/')).toBe(true)
  })
})

describe('Editor de quiz', () => {
  it('cria um quiz com perguntas do banco e volta já na edição', async () => {
    const usuario = userEvent.setup()
    const chamadas = logarComo(PROFESSOR, {
      ...rotasBase,
      'POST /quizzes/': (corpo) => [201, quizCompleto({ id: 7, titulo: corpo.titulo, status: corpo.status })],
      'GET /quizzes/7/': [200, quizCompleto({ id: 7, titulo: 'Planetas', status: 'rascunho' })],
    })
    renderizarApp('/adm/quiz/novo')

    expect(await screen.findByRole('heading', { name: 'Criar quiz' })).toBeInTheDocument()
    await usuario.type(screen.getByRole('textbox', { name: 'Título *' }), 'Planetas')
    await usuario.click(await screen.findByRole('checkbox', { name: 'Qual o maior planeta?' }))
    await usuario.click(screen.getByRole('checkbox', { name: 'Qual planeta é vermelho?' }))
    expect(screen.getByText('2 perguntas · arraste para reordenar')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Salvar quiz' }))

    expect(await screen.findByText('Quiz salvo.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Editar quiz' })).toBeInTheDocument()
    const envio = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/quizzes/')
    expect(envio.corpo).toEqual(
      expect.objectContaining({ titulo: 'Planetas', status: 'rascunho', perguntas_ids: [12, 11], tempo_padrao: 20 }),
    )
  })

  it('valida título e não publica sem perguntas', async () => {
    const usuario = userEvent.setup()
    const chamadas = logarComo(PROFESSOR, rotasBase)
    renderizarApp('/adm/quiz/novo')

    await usuario.click(await screen.findByRole('checkbox', { name: /Publicar quiz/ }))
    await usuario.click(screen.getByRole('button', { name: 'Salvar quiz' }))

    expect(screen.getByText('Dê um título para o quiz.')).toBeInTheDocument()
    expect(screen.getByText('Adicione ao menos uma pergunta para publicar o quiz.')).toBeInTheDocument()
    expect(chamadas.some((c) => c.caminho === '/quizzes/' && c.metodo === 'POST')).toBe(false)
  })

  it('cria pergunta pelo modal: vai para o banco e entra no quiz', async () => {
    const usuario = userEvent.setup()
    const chamadas = logarComo(PROFESSOR, {
      ...rotasBase,
      'POST /perguntas/': (corpo) => [201, pergunta(30, corpo.texto)],
    })
    renderizarApp('/adm/quiz/novo')

    await usuario.clear(await screen.findByRole('spinbutton', { name: 'Tempo padrão' }))
    await usuario.type(screen.getByRole('spinbutton', { name: 'Tempo padrão' }), '45')
    await usuario.click(screen.getByRole('button', { name: 'Criar pergunta' }))

    const modal = screen.getByRole('dialog', { name: 'Nova pergunta' })
    expect(within(modal).getByRole('spinbutton', { name: 'Tempo para responder *' })).toHaveValue(45)
    await usuario.type(within(modal).getByRole('textbox', { name: 'Texto da pergunta *' }), 'Quantas luas tem Marte?')
    for (const [letra, texto] of [['A', 'Uma'], ['B', 'Duas'], ['C', 'Três'], ['D', 'Nenhuma']]) {
      await usuario.type(within(modal).getByRole('textbox', { name: `Resposta ${letra} *` }), texto)
    }
    await usuario.click(within(modal).getByRole('radio', { name: 'B' }))
    await usuario.click(within(modal).getByRole('button', { name: 'Adicionar pergunta' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText(/1\. Quantas luas tem Marte\?/)).toBeInTheDocument()
    const envio = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/perguntas/')
    expect(envio.corpo).toEqual(
      expect.objectContaining({ resposta_correta: 'B', tempo_limite: 45, dificuldade: 'medio' }),
    )
  })

  it('o modal avisa campos vazios antes de enviar', async () => {
    const usuario = userEvent.setup()
    const chamadas = logarComo(PROFESSOR, rotasBase)
    renderizarApp('/adm/quiz/novo')

    await usuario.click(await screen.findByRole('button', { name: 'Criar pergunta' }))
    await usuario.click(screen.getByRole('button', { name: 'Adicionar pergunta' }))

    expect(screen.getByText('Escreva o texto da pergunta.')).toBeInTheDocument()
    expect(screen.getByText('Marque qual alternativa é a correta.')).toBeInTheDocument()
    expect(chamadas.some((c) => c.caminho === '/perguntas/' && c.metodo === 'POST')).toBe(false)
  })

  it('reordena pelo teclado e tira pergunta do quiz', async () => {
    const usuario = userEvent.setup()
    const chamadas = logarComo(PROFESSOR, {
      ...rotasBase,
      'GET /quizzes/1/': [200, quizCompleto({ status: 'rascunho' })],
      'PATCH /quizzes/1/': (corpo) => [200, quizCompleto({ status: 'rascunho', perguntas: [P2] , ...corpo })],
    })
    renderizarApp('/adm/quiz/1/editar')

    const alca = await screen.findByRole('button', { name: /Mover: Qual o maior planeta\?/ })
    alca.focus()
    await usuario.keyboard('{ArrowUp}')
    const itens = screen.getAllByRole('listitem').filter((li) => li.textContent.match(/^\d\./))
    expect(itens[0]).toHaveTextContent('1. Qual o maior planeta?')

    await usuario.click(screen.getByRole('button', { name: 'Tirar do quiz: Qual planeta é vermelho?' }))
    await usuario.click(screen.getByRole('button', { name: 'Salvar quiz' }))
    await waitFor(() =>
      expect(chamadas.find((c) => c.metodo === 'PATCH')?.corpo.perguntas_ids).toEqual([12]),
    )
  })

  it('lápis edita a pergunta só neste quiz', async () => {
    const usuario = userEvent.setup()
    const chamadas = logarComo(PROFESSOR, {
      ...rotasBase,
      'GET /quizzes/1/': [200, quizCompleto()],
      'PATCH /quizzes/1/perguntas/11/': (corpo) => [200, pergunta(40, corpo.texto, { no_banco: false })],
    })
    renderizarApp('/adm/quiz/1/editar')

    await usuario.click(await screen.findByRole('button', { name: 'Editar neste quiz: Qual planeta é vermelho?' }))
    const modal = screen.getByRole('dialog', { name: 'Editar pergunta' })
    const texto = within(modal).getByRole('textbox', { name: 'Texto da pergunta *' })
    await usuario.clear(texto)
    await usuario.type(texto, 'Qual planeta parece vermelho?')
    await usuario.click(within(modal).getByRole('button', { name: 'Salvar pergunta' }))

    expect(await screen.findByText('Pergunta atualizada só neste quiz.')).toBeInTheDocument()
    expect(screen.getByText('só neste quiz')).toBeInTheDocument()
    expect(chamadas.some((c) => c.metodo === 'PATCH' && c.caminho === '/quizzes/1/')).toBe(false)
    // O quiz continua sem alterações pendentes, então ainda dá para iniciar.
    expect(screen.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled()
  })

  it('iniciar partida só com o quiz publicado e salvo', async () => {
    const usuario = userEvent.setup()
    logarComo(PROFESSOR, { ...rotasBase, 'GET /quizzes/1/': [200, quizCompleto()] })
    renderizarApp('/adm/quiz/1/editar')

    const iniciar = await screen.findByRole('button', { name: 'Iniciar partida' })
    expect(iniciar).toBeEnabled()

    await usuario.type(screen.getByRole('textbox', { name: 'Título *' }), '!')
    expect(iniciar).toBeDisabled()
    expect(screen.getByText('Salve o quiz publicado para iniciar uma partida.')).toBeInTheDocument()

    await usuario.type(screen.getByRole('textbox', { name: 'Título *' }), '{Backspace}')
    await usuario.click(iniciar)
    expect(await screen.findByRole('heading', { name: 'Abrir sala' })).toBeInTheDocument()
  })

  it('mostra erro ao não conseguir carregar o quiz', async () => {
    logarComo(PROFESSOR, { ...rotasBase, 'GET /quizzes/9/': [404, { detail: 'Não encontrado.' }] })
    renderizarApp('/adm/quiz/9/editar')

    expect(await screen.findByText('Não encontrado.')).toBeInTheDocument()
  })
})

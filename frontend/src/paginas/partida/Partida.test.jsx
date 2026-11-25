import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ESTUDANTE, logarComo, PROFESSOR, renderizarApp, simularApi, simularWebSocket } from '../../testes/auxiliares'

const AGORA = Date.now()

const partidaBase = {
  id: 9,
  pin: '482917',
  titulo: 'Sistema Solar',
  disciplina: 'Ciências',
  estado: 'sala',
  numero: 0,
  total_perguntas: 3,
  participantes: 2,
  limite: 50,
  professor: 'Állex Thierry',
  quiz_id: 1,
}

const pergunta = {
  numero: 1,
  texto: 'Qual planeta é conhecido como Planeta Vermelho?',
  imagem: null,
  alternativas: [
    { letra: 'A', texto: 'Marte' },
    { letra: 'B', texto: 'Vênus' },
    { letra: 'C', texto: 'Júpiter' },
    { letra: 'D', texto: 'Saturno' },
  ],
  tempo: 20,
  prazo: AGORA + 15_000,
}

const ranking = [
  { id: 1, posicao: 1, apelido: 'Lucas', pontos: 4120, sequencia: 5, acertos: 3, variacao: 1 },
  { id: 2, posicao: 2, apelido: 'Beatriz', pontos: 3860, sequencia: 4, acertos: 3, variacao: 0 },
  { id: 3, posicao: 3, apelido: 'Ana', pontos: 3310, sequencia: 0, acertos: 2, variacao: -1 },
]

const professor = (extras = {}) => ({
  tipo: 'estado',
  papel: 'professor',
  agora: AGORA,
  partida: partidaBase,
  participantes: [
    { id: 1, apelido: 'Ana' },
    { id: 2, apelido: 'Lucas' },
  ],
  ...extras,
})

async function abrirTelao(rotas = {}) {
  const conexoes = simularWebSocket()
  const chamadas = logarComo(PROFESSOR, { 'GET /partidas/9/': [200, { id: 9, pin: '482917' }], ...rotas })
  renderizarApp('/adm/partidas/9')
  await waitFor(() => expect(conexoes).toHaveLength(1))
  const conexao = conexoes[0]
  expect(conexao.url).toMatch(/\/ws\/partidas\/482917\/\?token=token-acesso$/)
  return { conexao, chamadas }
}

describe('Telão do professor', () => {
  it('mostra PIN, participantes e inicia o jogo', async () => {
    const usuario = userEvent.setup()
    const { conexao } = await abrirTelao()
    act(() => conexao.receber(professor()))

    expect(await screen.findByText('482 917')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2 estudantes' })).toBeInTheDocument()
    expect(screen.getByText('Sala aberta · 2/50')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /Iniciar jogo/ }))
    expect(conexao.enviadas).toContainEqual({ acao: 'iniciar' })
  })

  it('não deixa iniciar sem participantes e permite remover alguém', async () => {
    const usuario = userEvent.setup()
    const { conexao } = await abrirTelao()
    act(() => conexao.receber(professor({ participantes: [] })))
    expect(await screen.findByRole('button', { name: /Iniciar jogo/ })).toBeDisabled()
    expect(screen.getByText('Esperando os estudantes entrarem…')).toBeInTheDocument()

    act(() => conexao.receber(professor()))
    await usuario.click(await screen.findByRole('button', { name: 'Remover Ana da sala' }))
    await usuario.click(screen.getByRole('button', { name: 'Remover' }))
    expect(conexao.enviadas).toContainEqual({ acao: 'remover', participante: 1 })
  })

  it('pergunta no telão com contagem e encerrar respostas', async () => {
    const usuario = userEvent.setup()
    const { conexao } = await abrirTelao()
    act(() =>
      conexao.receber(
        professor({ partida: { ...partidaBase, estado: 'pergunta', numero: 1 }, pergunta, respondidos: 1 }),
      ),
    )
    expect(await screen.findByRole('heading', { name: pergunta.texto })).toBeInTheDocument()
    expect(screen.getByText('1 de 2 responderam')).toBeInTheDocument()
    expect(screen.getByText('Pergunta 1 de 3')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/1[45]/)
    expect(screen.getByText('Saturno')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Encerrar respostas' }))
    expect(conexao.enviadas).toContainEqual({ acao: 'encerrar_respostas', numero: 1 })
  })

  it('resultado, ranking e avançar', async () => {
    const usuario = userEvent.setup()
    const { conexao } = await abrirTelao()
    const resultado = {
      distribuicao: [
        { letra: 'A', texto: 'Marte', quantidade: 18, percentual: 67, correta: true },
        { letra: 'B', texto: 'Vênus', quantidade: 4, percentual: 15, correta: false },
        { letra: 'C', texto: 'Júpiter', quantidade: 3, percentual: 11, correta: false },
        { letra: 'D', texto: 'Saturno', quantidade: 2, percentual: 7, correta: false },
      ],
      acertaram: 18,
      erraram: 9,
      tempo_medio: 8.4,
    }
    act(() =>
      conexao.receber(
        professor({
          partida: { ...partidaBase, estado: 'resultado', numero: 1 },
          pergunta: { ...pergunta, correta: 'A' },
          resultado,
          ranking,
        }),
      ),
    )
    expect(await screen.findByText('Distribuição das respostas')).toBeInTheDocument()
    expect(screen.getByText('18 · 67%')).toBeInTheDocument()
    expect(screen.getByText('8,4 s')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Ver ranking' }))
    expect(conexao.enviadas).toContainEqual({ acao: 'mostrar_ranking' })

    act(() =>
      conexao.receber(
        professor({
          partida: { ...partidaBase, estado: 'ranking', numero: 3 },
          pergunta: { ...pergunta, correta: 'A' },
          resultado,
          ranking,
        }),
      ),
    )
    expect(await screen.findByRole('heading', { name: 'Quem está voando mais alto?' })).toBeInTheDocument()
    expect(screen.getByText('4.120')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Subiu' })).toBeInTheDocument()
    // Última pergunta: o botão leva ao resultado final.
    await usuario.click(screen.getByRole('button', { name: /Ver resultado final/ }))
    expect(conexao.enviadas).toContainEqual({ acao: 'proxima' })
  })

  it('partida concluída com pódio, resumo e jogar novamente', async () => {
    const usuario = userEvent.setup()
    const { conexao, chamadas } = await abrirTelao({
      'POST /partidas/': [201, { id: 10, pin: '111222' }],
      'GET /partidas/10/': [200, { id: 10, pin: '111222' }],
    })
    act(() =>
      conexao.receber(
        professor({
          partida: { ...partidaBase, estado: 'encerrada', numero: 3 },
          ranking,
          estatisticas: {
            participantes: 3,
            media_acertos: 74,
            tempo_medio: 9.2,
            mais_dificil: { numero: 2, percentual: 10 },
            maior_acerto: { numero: 1, percentual: 93 },
          },
        }),
      ),
    )
    expect(await screen.findByRole('heading', { name: 'Partida concluída!' })).toBeInTheDocument()
    const podio = screen.getByLabelText('Pódio')
    expect(within(podio).getByLabelText('1º lugar: Lucas')).toBeInTheDocument()
    expect(screen.getByText('74%')).toBeInTheDocument()
    expect(screen.getByText('Pergunta 1 · 93%')).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveTextContent('Beatriz3/33.860')

    await usuario.click(screen.getByRole('button', { name: 'Jogar novamente' }))
    await waitFor(() =>
      expect(chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/partidas/')?.corpo).toEqual({
        quiz: 1,
        limite_participantes: 50,
      }),
    )
  })
})

describe('Abrir sala', () => {
  const quiz = { id: 1, titulo: 'Sistema Solar', disciplina: 'Ciências', turma: '', perguntas_total: 3, pode_iniciar: true }

  it('escolhe o limite e abre o telão', async () => {
    const usuario = userEvent.setup()
    simularWebSocket()
    const chamadas = logarComo(PROFESSOR, {
      'GET /quizzes/1/': [200, quiz],
      'POST /partidas/': [201, { id: 9, pin: '482917' }],
      'GET /partidas/9/': [200, { id: 9, pin: '482917' }],
    })
    renderizarApp('/adm/quiz/1/partida')

    const limite = await screen.findByRole('spinbutton', { name: 'Limite de participantes' })
    expect(limite).toHaveValue(50)
    await usuario.clear(limite)
    await usuario.type(limite, '0')
    await usuario.click(screen.getByRole('button', { name: 'Abrir sala' }))
    expect(screen.getByText('Use um número entre 1 e 500.')).toBeInTheDocument()

    await usuario.clear(limite)
    await usuario.type(limite, '30')
    await usuario.click(screen.getByRole('button', { name: 'Abrir sala' }))
    expect(await screen.findByText('Abrindo a sala…')).toBeInTheDocument()
    expect(chamadas.find((c) => c.metodo === 'POST').corpo).toEqual({ quiz: 1, limite_participantes: 30 })
  })

  it('avisa quando o quiz não está publicado', async () => {
    logarComo(PROFESSOR, { 'GET /quizzes/1/': [200, { ...quiz, pode_iniciar: false }] })
    renderizarApp('/adm/quiz/1/partida')
    expect(await screen.findByText(/Publique o quiz/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir sala' })).not.toBeInTheDocument()
  })
})

describe('Entrar com PIN', () => {
  it('cola o PIN, escolhe apelido e entra no jogo', async () => {
    const usuario = userEvent.setup()
    simularWebSocket()
    const chamadas = simularApi({
      'POST /partidas/entrar/': [201, { chave: 'abc', apelido: 'Ana', partida: { pin: '482917', titulo: 'Sistema Solar' } }],
    })
    renderizarApp('/entrar-pin')

    await usuario.click(screen.getByRole('textbox', { name: 'Dígito 1 do PIN' }))
    await usuario.paste('482917')
    expect(screen.getByRole('textbox', { name: 'Dígito 6 do PIN' })).toHaveValue('7')
    await usuario.type(screen.getByRole('textbox', { name: 'Seu apelido' }), 'Ana')
    await usuario.click(screen.getByRole('button', { name: /Entrar no jogo/ }))

    expect(await screen.findByText('Entrando na sala…')).toBeInTheDocument()
    expect(chamadas[0].corpo).toEqual({ pin: '482917', apelido: 'Ana' })
    expect(JSON.parse(localStorage.getItem('sabia.partida'))).toEqual(
      expect.objectContaining({ pin: '482917', chave: 'abc' }),
    )
  })

  it('pré-preenche o PIN do QR Code e mostra erros do servidor', async () => {
    const usuario = userEvent.setup()
    simularApi({ 'POST /partidas/entrar/': [400, { apelido: ['Esse apelido já está em uso nesta sala. Escolha outro.'] }] })
    renderizarApp('/entrar-pin?pin=482917')

    expect(screen.getByRole('textbox', { name: 'Dígito 3 do PIN' })).toHaveValue('2')
    await usuario.click(screen.getByRole('button', { name: /Entrar no jogo/ }))
    expect(screen.getByText('Escolha um apelido para entrar.')).toBeInTheDocument()

    await usuario.type(screen.getByRole('textbox', { name: 'Seu apelido' }), 'Ana')
    await usuario.click(screen.getByRole('button', { name: /Entrar no jogo/ }))
    expect(await screen.findByText('Esse apelido já está em uso nesta sala. Escolha outro.')).toBeInTheDocument()
  })

  it('estudante logado já vem com o nome como apelido', async () => {
    logarComo(ESTUDANTE)
    renderizarApp('/entrar-pin')
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Seu apelido' })).toHaveValue('AllexThierry'))
    expect(screen.queryByRole('link', { name: /Entrar na minha conta/ })).not.toBeInTheDocument()
  })
})

describe('Jogo do estudante', () => {
  const estudante = (extras = {}) => ({
    tipo: 'estado',
    papel: 'participante',
    agora: AGORA,
    partida: partidaBase,
    voce: { id: 3, apelido: 'Ana', pontos: 3310, posicao: 3, sequencia: 4, variacao: 2 },
    ...extras,
  })

  async function abrirJogo() {
    localStorage.setItem('sabia.partida', JSON.stringify({ pin: '482917', chave: 'abc', apelido: 'Ana' }))
    const conexoes = simularWebSocket()
    simularApi()
    renderizarApp('/jogo/482917')
    await waitFor(() => expect(conexoes).toHaveLength(1))
    expect(conexoes[0].url).toMatch(/\?chave=abc$/)
    return conexoes[0]
  }

  it('sem participação guardada volta para digitar o PIN', () => {
    simularApi()
    renderizarApp('/jogo/482917')
    expect(screen.getByRole('textbox', { name: 'Dígito 1 do PIN' })).toHaveValue('4')
  })

  it('espera na sala e pode sair', async () => {
    const usuario = userEvent.setup()
    const conexao = await abrirJogo()
    act(() => conexao.receber(estudante()))
    expect(await screen.findByText('Você está na sala!')).toBeInTheDocument()
    expect(screen.getByText('Prof. Állex Thierry')).toBeInTheDocument()
    expect(screen.getByText('2 jogadores')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: /Sair da sala/ }))
    expect(conexao.enviadas).toContainEqual({ acao: 'sair' })
    expect(localStorage.getItem('sabia.partida')).toBeNull()
  })

  it('responde a pergunta e aguarda os outros', async () => {
    const usuario = userEvent.setup()
    const conexao = await abrirJogo()
    act(() => conexao.receber(estudante({ partida: { ...partidaBase, estado: 'pergunta', numero: 1 }, pergunta, resposta: null })))
    expect(await screen.findByRole('heading', { name: pergunta.texto })).toBeInTheDocument()
    expect(screen.getByText('3.310')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Responder: Júpiter' }))
    expect(conexao.enviadas).toContainEqual({ acao: 'responder', letra: 'C' })
    expect(screen.getByText('Resposta enviada! Aguarde os outros jogadores.')).toBeInTheDocument()
  })

  it('mostra se acertou ou errou', async () => {
    const conexao = await abrirJogo()
    const comum = { partida: { ...partidaBase, estado: 'resultado', numero: 1 }, pergunta, resposta: { letra: 'A' }, ranking }
    act(() =>
      conexao.receber(
        estudante({ ...comum, feedback: { respondeu: true, correta: true, pontos: 860, bonus: 100, resposta_correta: 'Marte' } }),
      ),
    )
    expect(await screen.findByRole('heading', { name: 'Correta' })).toBeInTheDocument()
    expect(screen.getByText('Você está no pódio!')).toBeInTheDocument()
    expect(screen.getByText('+ 960')).toBeInTheDocument()

    act(() =>
      conexao.receber(
        estudante({ ...comum, feedback: { respondeu: true, correta: false, pontos: 0, bonus: 0, resposta_correta: 'Marte' } }),
      ),
    )
    expect(await screen.findByRole('heading', { name: 'Incorreta' })).toBeInTheDocument()
    expect(screen.getByText('A resposta correta era Marte')).toBeInTheDocument()
    expect(screen.getByText('+ 0')).toBeInTheDocument()
  })

  it('ranking parcial com a própria posição', async () => {
    const conexao = await abrirJogo()
    act(() =>
      conexao.receber(
        estudante({
          partida: { ...partidaBase, estado: 'ranking', numero: 1 },
          ranking: ranking.slice(0, 2),
          feedback: { respondeu: true, correta: true, pontos: 900, bonus: 0, resposta_correta: 'Marte' },
        }),
      ),
    )
    expect(await screen.findByRole('heading', { name: 'Você está em 3º' })).toBeInTheDocument()
    expect(screen.getByText('Você subiu 2 posições!')).toBeInTheDocument()
    const minhaLinha = screen.getByText('VOCÊ').closest('li')
    expect(minhaLinha).toHaveAttribute('aria-current', 'true')
    expect(minhaLinha).toHaveTextContent('4 acertos seguidos')
  })

  it('fim de jogo com desempenho e pódio', async () => {
    const conexao = await abrirJogo()
    act(() =>
      conexao.receber(
        estudante({
          partida: { ...partidaBase, estado: 'encerrada', numero: 3 },
          ranking,
          final: { posicao: 3, pontos: 7840, acertos: 8, erros: 2, percentual: 80, maior_sequencia: 5, participantes: 3 },
        }),
      ),
    )
    expect(await screen.findByRole('heading', { name: 'Seu voo terminou!' })).toBeInTheDocument()
    expect(screen.getByText('7.840 pontos')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Pódio')).getByLabelText('3º lugar: Ana')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/entrar-pin')
  })

  it('avisa quando o estudante é removido', async () => {
    const conexao = await abrirJogo()
    act(() => conexao.receber({ tipo: 'removido' }))
    expect(await screen.findByRole('heading', { name: 'Você foi removido da sala' })).toBeInTheDocument()
  })
})

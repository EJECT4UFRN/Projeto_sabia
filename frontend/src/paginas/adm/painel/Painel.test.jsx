import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { logarComo, PROFESSOR, renderizarApp, simularWebSocket } from '../../../testes/auxiliares'

const partida = (id, situacao, extras = {}) => ({
  id,
  titulo: `Jogo ${id}`,
  disciplina: 'Ciências',
  pin: '482719',
  jogadores: 18,
  situacao,
  criada_em: '2026-10-19T12:00:00Z',
  encerrada_em: null,
  ...extras,
})

const PAINEL = {
  perguntas_total: 86,
  jogos_ativos: 1,
  aguardando: 2,
  concluidos: 24,
  recentes: [
    partida(1, 'em_andamento', { titulo: 'Energia Solar — Etapa 1' }),
    partida(2, 'finalizado', { titulo: 'Reciclagem e Economia Circular', pin: '301558', jogadores: 22 }),
    partida(3, 'aguardando', { titulo: 'Quiz Diagnóstico — Turma B', pin: '119204', jogadores: 6 }),
  ],
}

describe('Dashboard do professor', () => {
  it('mostra saudação, números e jogos recentes com o destino certo', async () => {
    logarComo(PROFESSOR, { 'GET /painel/': [200, PAINEL] })
    renderizarApp('/adm')

    expect(await screen.findByRole('heading', { name: 'Olá, Állex!' })).toBeInTheDocument()
    const resumo = screen.getByRole('region', { name: 'Resumo' })
    expect(await within(resumo).findByText('86')).toBeInTheDocument()
    expect(within(resumo).getByText('24')).toBeInTheDocument()
    expect(within(resumo).getByText('Ao vivo')).toBeInTheDocument()

    const recentes = screen.getByRole('list', { name: 'Jogos recentes' })
    const ativa = within(recentes).getByRole('link', { name: /Energia Solar/ })
    expect(ativa).toHaveAttribute('href', '/adm/partidas/1')
    expect(ativa).toHaveTextContent('482 719')
    expect(ativa).toHaveTextContent('Em Andamento')
    expect(within(recentes).getByRole('link', { name: /Reciclagem/ })).toHaveAttribute(
      'href',
      '/adm/partidas/2/relatorio',
    )
    expect(screen.getByRole('link', { name: 'Ver mais' })).toHaveAttribute('href', '/adm/partidas')
    expect(screen.getByRole('link', { name: /Criar nova pergunta/ })).toHaveAttribute('href', '/adm/perguntas/nova')
    expect(screen.getByRole('link', { name: 'Novo jogo' })).toHaveAttribute('href', '/adm/quiz/novo')
  })

  it('sem partidas mostra o convite; erro deixa tentar de novo', async () => {
    logarComo(PROFESSOR, { 'GET /painel/': [200, { ...PAINEL, recentes: [] }] })
    const { unmount } = renderizarApp('/adm')
    expect(await screen.findByText('Nenhuma partida ainda')).toBeInTheDocument()
    unmount()

    logarComo(PROFESSOR, { 'GET /painel/': [500, {}] })
    renderizarApp('/adm')
    expect(await screen.findByRole('alert')).toHaveTextContent('O Sabiá teve um problema')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('"Iniciar sessão ao vivo" escolhe um quiz publicado e vai abrir a sala', async () => {
    const usuarioEvento = userEvent.setup()
    const chamadas = logarComo(PROFESSOR, {
      'GET /painel/': [200, PAINEL],
      'GET /quizzes/': [
        200,
        {
          count: 2,
          results: [
            { id: 7, titulo: 'Sistema Solar', disciplina: 'Ciências', perguntas_total: 10, status: 'publicado' },
            { id: 8, titulo: 'Sem perguntas', disciplina: '', perguntas_total: 0, status: 'publicado' },
          ],
        },
      ],
      'GET /quizzes/7/': [200, { id: 7, titulo: 'Sistema Solar', disciplina: 'Ciências', perguntas_total: 10, pode_iniciar: true, perguntas: [] }],
    })
    renderizarApp('/adm')
    await usuarioEvento.click(await screen.findByRole('button', { name: /Iniciar sessão ao vivo/ }))
    const dialogo = screen.getByRole('dialog', { name: 'Qual quiz vamos jogar?' })
    expect(await within(dialogo).findByRole('button', { name: /Sistema Solar/ })).toBeInTheDocument()
    expect(within(dialogo).queryByText('Sem perguntas')).not.toBeInTheDocument()
    expect(chamadas.find((c) => c.caminho === '/quizzes/').consulta).toEqual(
      expect.objectContaining({ status: 'publicado' }),
    )
    await usuarioEvento.click(within(dialogo).getByRole('button', { name: /Sistema Solar/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(chamadas.some((c) => c.caminho === '/quizzes/7/')).toBe(true)
  })
})

describe('Busca do cabeçalho', () => {
  it('mostra quizzes e alunos e abre o escolhido com o teclado', async () => {
    const usuarioEvento = userEvent.setup()
    logarComo(PROFESSOR, {
      'GET /painel/': [200, PAINEL],
      'GET /painel/busca/': [
        200,
        {
          quizzes: [{ id: 4, titulo: 'Energia Solar', disciplina: 'Ciências', status: 'publicado' }],
          alunos: [
            { id: 9, nome: 'Ana Energia', username: 'ana', iniciais: 'AE', cor_avatar: 'azul', turma: { id: 5, nome: '8º Ano A' } },
          ],
        },
      ],
      'GET /turmas/5/': [200, { id: 5, nome: '8º Ano A', codigo: 'ABC234', alunos_total: 0, alunos: [] }],
    })
    renderizarApp('/adm')
    const campo = await screen.findByRole('combobox', { name: 'Buscar quizzes ou jogadores' })
    await usuarioEvento.type(campo, 'energia')
    const lista = await screen.findByRole('listbox', { name: 'Resultados da busca' })
    expect(await within(lista).findByText('Energia Solar')).toBeInTheDocument()
    expect(within(lista).getByText('8º Ano A')).toBeInTheDocument()
    await usuarioEvento.keyboard('{ArrowDown}{Enter}')
    expect(await screen.findByRole('heading', { name: '8º Ano A', level: 1 })).toBeInTheDocument()
  })
})

describe('Minhas partidas', () => {
  it('lista e filtra por situação', async () => {
    const usuarioEvento = userEvent.setup()
    const chamadas = logarComo(PROFESSOR, {
      'GET /partidas/': [200, { count: 2, results: [partida(1, 'em_andamento'), partida(2, 'finalizado')] }],
    })
    renderizarApp('/adm/partidas')
    expect(await screen.findByRole('link', { name: /Jogo 1/ })).toBeInTheDocument()
    expect(screen.getByText('Exibindo 2 de 2 partidas')).toBeInTheDocument()
    await usuarioEvento.click(screen.getByRole('button', { name: 'Finalizadas' }))
    await waitFor(() => expect(chamadas.at(-1).consulta).toEqual(expect.objectContaining({ situacao: 'finalizado' })))
  })

  it('estado vazio', async () => {
    logarComo(PROFESSOR, { 'GET /partidas/': [200, { count: 0, results: [] }] })
    renderizarApp('/adm/partidas')
    expect(await screen.findByText('Você ainda não abriu nenhuma sala')).toBeInTheDocument()
  })
})

describe('Relatório da partida', () => {
  const RELATORIO = {
    id: 2,
    titulo: 'Reciclagem',
    disciplina: 'Ciências',
    pin: '301558',
    iniciada_em: '2026-10-19T12:00:00Z',
    encerrada_em: '2026-10-19T12:20:00Z',
    total_perguntas: 2,
    estatisticas: { participantes: 2, media_acertos: 75, tempo_medio: 4.2, mais_dificil: { numero: 1, percentual: 50 }, maior_acerto: { numero: 2, percentual: 100 } },
    ranking: [
      { id: 1, posicao: 1, apelido: 'Kevin', pontos: 8154, acertos: 2, com_conta: true },
      { id: 2, posicao: 2, apelido: 'Harry', pontos: 7488, acertos: 1, com_conta: false },
    ],
    perguntas: [
      {
        numero: 1,
        texto: 'O que é reciclagem?',
        resposta_correta: 'Reaproveitar',
        responderam: 2,
        acertaram: 1,
        percentual: 50,
        distribuicao: [
          { letra: 'A', texto: 'Reaproveitar', quantidade: 1, correta: true },
          { letra: 'B', texto: 'Queimar', quantidade: 1, correta: false },
          { letra: 'C', texto: 'Enterrar', quantidade: 0, correta: false },
          { letra: 'D', texto: 'Jogar fora', quantidade: 0, correta: false },
        ],
      },
    ],
  }

  it('mostra pódio, números, ranking e acerto por pergunta', async () => {
    logarComo(PROFESSOR, { 'GET /partidas/2/relatorio/': [200, RELATORIO] })
    renderizarApp('/adm/partidas/2/relatorio')
    expect(await screen.findByRole('heading', { name: 'Reciclagem' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: '1º lugar: Kevin, 8.154 pontos' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: '3º lugar vago' })).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('Pergunta 1 · 50%')).toBeInTheDocument()
    const tabela = screen.getByRole('table')
    expect(within(tabela).getByText('convidado')).toBeInTheDocument()
    expect(within(tabela).getByText('2/2')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Acertos da pergunta 1' })).toHaveAttribute('aria-valuenow', '50')
  })

  it('partida ainda ativa volta para o telão', async () => {
    simularWebSocket()
    const chamadas = logarComo(PROFESSOR, {
      'GET /partidas/3/relatorio/': [409, { detail: 'O relatório fica pronto quando a partida termina.' }],
      'GET /partidas/3/': [200, { id: 3, pin: '119204', titulo: 'Q', estado: 'sala', limite_participantes: 10, total_perguntas: 2 }],
    })
    renderizarApp('/adm/partidas/3/relatorio')
    await waitFor(() => expect(chamadas.some((c) => c.caminho === '/partidas/3/')).toBe(true))
  })
})

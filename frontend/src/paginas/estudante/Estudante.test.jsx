import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ESTUDANTE, logarComo, PROFESSOR, renderizarApp, simularWebSocket } from '../../testes/auxiliares'

const usuario = { ...ESTUDANTE, nome: 'ÁllexThierry', nome_exibicao: '', iniciais: 'ÁT', date_joined: '2026-06-10T12:00:00Z', sobre_mim: '' }

const partida = (id, extras = {}) => ({
  id,
  titulo: `Quiz ${id}`,
  disciplina: 'Ciências',
  pin: '482719',
  data: '2026-07-18T12:00:00Z',
  pontos: 1000,
  estado: 'encerrada',
  posicao: 2,
  participantes: 5,
  ...extras,
})

describe('Meu histórico', () => {
  it('mostra os números, as partidas e destaca o recorde', async () => {
    logarComo(usuario, {
      'GET /historico/': [
        200,
        {
          count: 2,
          resumo: { partidas: 2, recorde: 2340, pontos_totais: 3950 },
          results: [partida(1, { pontos: 2340 }), partida(2, { pontos: 1610, estado: 'em_curso', posicao: undefined })],
        },
      ],
    })
    renderizarApp('/historico')

    expect(await screen.findByRole('heading', { name: 'ÁllexThierry' })).toBeInTheDocument()
    expect(await screen.findAllByText('2.340')).toHaveLength(2)
    expect(screen.getByText('3.950')).toBeInTheDocument()
    const encerrada = screen.getByRole('link', { name: 'Ver resumo: Quiz 1' })
    expect(encerrada).toHaveAttribute('href', '/historico/1')
    expect(within(encerrada).getByText('2º de 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar para a partida Quiz 2' })).toHaveTextContent('Em curso')
  })

  it('volta para uma partida em curso', async () => {
    const usuarioEvento = userEvent.setup()
    simularWebSocket()
    logarComo(usuario, {
      'GET /historico/': [200, { count: 1, resumo: { partidas: 1, recorde: 0, pontos_totais: 0 }, results: [partida(7, { estado: 'em_curso', pontos: 0 })] }],
      'POST /historico/7/retomar/': [200, { pin: '482719', chave: 'abc', apelido: 'Ana', titulo: 'Quiz 7' }],
    })
    renderizarApp('/historico')
    await usuarioEvento.click(await screen.findByRole('button', { name: 'Voltar para a partida Quiz 7' }))
    expect(await screen.findByText('Entrando na sala…')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('sabia.partida'))).toEqual(expect.objectContaining({ chave: 'abc' }))
  })

  it('estado vazio e carregar mais', async () => {
    logarComo(usuario, {
      'GET /historico/': [200, { count: 0, resumo: { partidas: 0, recorde: 0, pontos_totais: 0 }, results: [] }],
    })
    renderizarApp('/historico')
    expect(await screen.findByText('Você ainda não jogou nenhuma partida com sua conta.')).toBeInTheDocument()
  })

  it('carrega a próxima página', async () => {
    const usuarioEvento = userEvent.setup()
    const chamadas = logarComo(usuario, {
      'GET /historico/': [200, { count: 11, resumo: { partidas: 11, recorde: 1000, pontos_totais: 11000 }, results: Array.from({ length: 10 }, (_, i) => partida(i + 1)) }],
      'GET /historico/?pagina=2': [200, { count: 11, resumo: {}, results: [partida(11)] }],
    })
    renderizarApp('/historico')
    await usuarioEvento.click(await screen.findByRole('button', { name: 'Carregar mais' }))
    expect(await screen.findByRole('link', { name: 'Ver resumo: Quiz 11' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
    expect(chamadas.some((c) => c.consulta.pagina === '2')).toBe(true)
  })
})

describe('Resumo da partida', () => {
  it('mostra posição, números e cada pergunta', async () => {
    logarComo(usuario, {
      'GET /historico/3/': [
        200,
        {
          ...partida(3),
          professor: 'Állex',
          acertos: 1,
          erros: 1,
          percentual: 50,
          maior_sequencia: 1,
          total_perguntas: 2,
          perguntas: [
            { numero: 1, texto: 'Planeta vermelho?', resposta_correta: 'Marte', sua_resposta: 'Marte', acertou: true, pontos: 950, tempo: 1.2 },
            { numero: 2, texto: 'Maior planeta?', resposta_correta: 'Júpiter', sua_resposta: null, acertou: false, pontos: 0, tempo: null },
          ],
        },
      ],
    })
    renderizarApp('/historico/3')
    expect(await screen.findByRole('heading', { name: 'Quiz 3' })).toBeInTheDocument()
    expect(screen.getByText('de 5 jogadores')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    const itens = screen.getAllByRole('listitem')
    expect(within(itens[0]).getByRole('img', { name: 'Acertou' })).toBeInTheDocument()
    expect(itens[1]).toHaveTextContent('Sua resposta: sem resposta · Correta: Júpiter')
  })

  it('partida em curso volta para o histórico', async () => {
    logarComo(usuario, {
      'GET /historico/4/': [409, { detail: 'Esta partida ainda está em curso.', em_curso: true }],
      'GET /historico/': [200, { count: 0, resumo: { partidas: 0, recorde: 0, pontos_totais: 0 }, results: [] }],
    })
    renderizarApp('/historico/4')
    expect(await screen.findByText('Meu histórico')).toBeInTheDocument()
  })
})

describe('Perfil', () => {
  it('troca nome e cor com prévia e salva', async () => {
    const usuarioEvento = userEvent.setup()
    const chamadas = logarComo(usuario, {
      'PATCH /auth/eu/': (corpo) => [200, { ...usuario, ...corpo, nome: corpo.nome_exibicao, iniciais: 'ÁS' }],
    })
    renderizarApp('/perfil')

    expect(await screen.findByText('Membro desde jun/2026')).toBeInTheDocument()
    await usuarioEvento.type(screen.getByRole('textbox', { name: 'Nome de exibição:' }), 'Állex Souza')
    expect(screen.getByText('Állex Souza')).toBeInTheDocument()
    await usuarioEvento.click(screen.getByRole('radio', { name: 'Roxo' }))
    await usuarioEvento.type(screen.getByRole('textbox', { name: 'Sobre mim' }), 'Gosto de ciências')
    expect(screen.getByText('17/200')).toBeInTheDocument()
    await usuarioEvento.click(screen.getByRole('button', { name: /Salvar perfil/ }))

    expect(await screen.findByText('Perfil salvo.')).toBeInTheDocument()
    const envio = chamadas.find((c) => c.metodo === 'PATCH')
    expect(envio.corpo).toEqual({ nome_exibicao: 'Állex Souza', cor_avatar: 'roxo', sobre_mim: 'Gosto de ciências' })
  })

  it('trocar e-mail pede a senha atual', async () => {
    const usuarioEvento = userEvent.setup()
    const chamadas = logarComo(usuario, {
      'PATCH /auth/eu/': [400, { senha_atual: ['Senha atual incorreta.'] }],
    })
    renderizarApp('/perfil')
    const email = await screen.findByRole('textbox', { name: 'Email:' })
    expect(email).toHaveAttribute('readonly')
    await usuarioEvento.click(screen.getByRole('button', { name: 'Alterar e-mail' }))
    await usuarioEvento.clear(email)
    await usuarioEvento.type(email, 'novo@exemplo.com')
    await usuarioEvento.click(screen.getByRole('button', { name: /Salvar perfil/ }))
    expect(screen.getByText('Digite sua senha atual para trocar o e-mail.')).toBeInTheDocument()
    expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(false)

    await usuarioEvento.type(screen.getByLabelText('Senha atual (para trocar o e-mail)'), 'errada')
    await usuarioEvento.click(screen.getByRole('button', { name: /Salvar perfil/ }))
    expect(await screen.findByText('Senha atual incorreta.')).toBeInTheDocument()
    expect(chamadas.find((c) => c.metodo === 'PATCH').corpo).toEqual(
      expect.objectContaining({ email: 'novo@exemplo.com', senha_atual: 'errada' }),
    )
  })

  it('altera a senha', async () => {
    const usuarioEvento = userEvent.setup()
    const chamadas = logarComo(usuario, { 'POST /auth/alterar-senha/': [204, null] })
    renderizarApp('/perfil')
    await usuarioEvento.click(await screen.findByRole('button', { name: 'Alterar senha' }))
    expect(screen.getByText('Digite sua senha atual.')).toBeInTheDocument()

    await usuarioEvento.type(screen.getByLabelText('Senha atual'), 'Antiga#2026')
    await usuarioEvento.type(screen.getByLabelText('Nova senha'), 'Nova#Senha2026')
    await usuarioEvento.type(screen.getByLabelText('Confirmar nova senha'), 'Nova#Senha2026')
    await usuarioEvento.click(screen.getByRole('button', { name: 'Alterar senha' }))
    expect(await screen.findByText('Senha alterada.')).toBeInTheDocument()
    expect(chamadas.find((c) => c.caminho === '/auth/alterar-senha/').corpo).toEqual({
      senha_atual: 'Antiga#2026',
      senha: 'Nova#Senha2026',
      confirmar_senha: 'Nova#Senha2026',
    })
  })

  it('professor tem o perfil dentro do painel', async () => {
    logarComo({ ...PROFESSOR, date_joined: '2026-06-01T00:00:00Z', nome_exibicao: '', sobre_mim: '' })
    renderizarApp('/adm/perfil')
    expect(await screen.findByRole('complementary', { name: 'Menu do painel administrativo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Meu perfil' })).toHaveAttribute('href', '/adm/perfil')
    expect(screen.getByRole('button', { name: /Salvar perfil/ })).toBeInTheDocument()
  })

  it('Jogar leva para digitar o PIN', async () => {
    logarComo(usuario)
    renderizarApp('/jogar')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Entre no jogo. Digite o PIN.' })).toBeInTheDocument())
  })
})

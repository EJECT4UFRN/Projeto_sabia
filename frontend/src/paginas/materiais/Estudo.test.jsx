import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ESTUDANTE, logarComo, renderizarApp, simularApi } from '../../testes/auxiliares'

const material = (id, extras = {}) => ({
  id,
  titulo: `Material ${id}`,
  descricao: 'Conheça o efeito fotovoltaico.',
  disciplina: 'Energia solar',
  professor: 'Állex Thierry',
  tipo: 'video',
  url: 'https://youtu.be/dQw4w9WgXcQ',
  youtube_id: 'dQw4w9WgXcQ',
  arquivo: null,
  tamanho: null,
  extensao: '',
  duracao: '06:24',
  tempo_leitura: null,
  capa_url: null,
  permitir_concluir: false,
  concluido: false,
  criado_em: '2026-09-02T12:00:00Z',
  ...extras,
})

const pagina = (results, count = results.length) => ({ count, results })

describe('Continue aprendendo', () => {
  it('visitante vê os materiais públicos, sem nome no título', async () => {
    simularApi({
      'GET /estudo/': [
        200,
        pagina([
          material(1, { titulo: 'Como a luz vira eletricidade?' }),
          material(2, { titulo: 'O potencial solar de Mossoró', tipo: 'artigo', youtube_id: '', tempo_leitura: 5 }),
          material(3, { titulo: 'Pequenas atitudes', tipo: 'documento', youtube_id: '', url: '', extensao: 'PDF', tamanho: 2516582 }),
        ]),
      ],
    })
    renderizarApp('/materiais')

    expect(await screen.findByRole('heading', { name: 'Como a luz vira eletricidade?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Continue aprendendo.')
    expect(screen.getByText('06:24')).toBeInTheDocument()
    expect(screen.getByText('5 min de leitura')).toBeInTheDocument()
    expect(screen.getByText('PDF · 2,4 MB')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Pequenas atitudes/ })).toHaveTextContent('Abrir PDF')
    expect(screen.getByText('3 materiais')).toBeInTheDocument()
  })

  it('estudante vê o nome, recomendados e filtra por formato', async () => {
    const usuarioEvento = userEvent.setup()
    const chamadas = logarComo({ ...ESTUDANTE, nome: 'Állex Thierry' }, { 'GET /estudo/': [200, pagina([material(1, { concluido: true })])] })
    renderizarApp('/materiais')

    expect(await screen.findByText('Állex.')).toBeInTheDocument()
    expect(screen.getByText('Recomendados')).toBeInTheDocument()
    expect(await screen.findByText('✓ Concluído')).toBeInTheDocument()
    await usuarioEvento.selectOptions(screen.getByRole('combobox', { name: 'Formato' }), 'artigo')
    await waitFor(() => expect(chamadas.at(-1).consulta).toEqual(expect.objectContaining({ tipo: 'artigo' })))
    expect(screen.getByRole('button', { name: 'Artigos' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sem materiais, o estudante é levado a entrar na turma', async () => {
    logarComo(ESTUDANTE, { 'GET /estudo/': [200, pagina([])] })
    renderizarApp('/materiais')
    expect(await screen.findByText('Nenhum material por aqui ainda')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'seu perfil' })).toHaveAttribute('href', '/perfil')
  })

  it('mostra erro e deixa tentar de novo', async () => {
    simularApi({ 'GET /estudo/': [500, {}] })
    renderizarApp('/materiais')
    expect(await screen.findByRole('alert')).toHaveTextContent('O Sabiá teve um problema')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
})

describe('Material aberto', () => {
  it('toca o vídeo do YouTube e marca como concluído', async () => {
    const usuarioEvento = userEvent.setup()
    logarComo(ESTUDANTE, {
      'GET /estudo/1/': [200, material(1, { permitir_concluir: true })],
      'POST /estudo/1/concluir/': [200, material(1, { permitir_concluir: true, concluido: true })],
    })
    renderizarApp('/materiais/1')

    expect(await screen.findByTitle('Vídeo: Material 1')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
    expect(screen.getByText('Material de Állex Thierry')).toBeInTheDocument()
    await usuarioEvento.click(screen.getByRole('button', { name: 'Marcar como concluído' }))
    expect(await screen.findByRole('button', { name: '✓ Concluído' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('documento abre o arquivo; visitante é convidado a entrar para concluir', async () => {
    simularApi({
      'GET /estudo/3/': [
        200,
        material(3, {
          tipo: 'documento',
          youtube_id: '',
          url: '',
          arquivo: 'http://localhost/media/lista.pdf',
          extensao: 'PDF',
          tamanho: 102400,
          permitir_concluir: true,
        }),
      ],
    })
    renderizarApp('/materiais/3')
    const abrir = await screen.findByRole('link', { name: /Abrir PDF/ })
    expect(abrir).toHaveAttribute('href', 'http://localhost/media/lista.pdf')
    expect(within(abrir).getByText('100 KB')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entre na sua conta' })).toBeInTheDocument()
  })

  it('material de outra turma ou fora do ar', async () => {
    simularApi({ 'GET /estudo/9/': [404, { detail: 'Não encontrado.' }] })
    renderizarApp('/materiais/9')
    expect(await screen.findByText('Material indisponível')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar')
  })
})

describe('Minhas turmas no perfil', () => {
  const usuario = { ...ESTUDANTE, nome_exibicao: '', sobre_mim: '', date_joined: '2026-06-10T12:00:00Z' }

  it('entra pelo código e sai da turma', async () => {
    const usuarioEvento = userEvent.setup()
    logarComo(usuario, {
      'GET /minhas-turmas/': [200, []],
      'POST /minhas-turmas/entrar/': (corpo) =>
        corpo.codigo === 'ERRADO'
          ? [400, { codigo: ['Código não encontrado. Confira com seu professor.'] }]
          : [201, { id: 5, nome: '8º Ano A', professor: 'Állex Thierry' }],
      'DELETE /minhas-turmas/5/': [204, null],
    })
    renderizarApp('/perfil')

    expect(await screen.findByText('Você ainda não está em nenhuma turma.')).toBeInTheDocument()
    const campo = screen.getByLabelText('Código da turma')
    await usuarioEvento.type(campo, 'errado')
    expect(campo).toHaveValue('ERRADO')
    await usuarioEvento.click(screen.getByRole('button', { name: 'Entrar na turma' }))
    expect(await screen.findByText('Código não encontrado. Confira com seu professor.')).toBeInTheDocument()

    await usuarioEvento.clear(campo)
    await usuarioEvento.type(campo, 'abc234')
    await usuarioEvento.click(screen.getByRole('button', { name: 'Entrar na turma' }))
    expect(await screen.findByText(/Você entrou na turma 8º Ano A/)).toBeInTheDocument()
    expect(screen.getByText('Prof. Állex Thierry')).toBeInTheDocument()

    await usuarioEvento.click(screen.getByRole('button', { name: 'Sair' }))
    expect(await screen.findByText('Você saiu da turma 8º Ano A.')).toBeInTheDocument()
  })
})

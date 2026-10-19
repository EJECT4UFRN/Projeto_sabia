import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { logarComo, PROFESSOR, renderizarApp } from '../../../testes/auxiliares'

const material = (id, extras = {}) => ({
  id,
  titulo: `Material ${id}`,
  descricao: 'Uma introdução aos planetas.',
  disciplina: 3,
  disciplina_nome: 'Ciências',
  tipo: 'video',
  arquivo: null,
  arquivo_nome: '',
  tamanho: null,
  extensao: '',
  url: 'https://youtu.be/dQw4w9WgXcQ',
  youtube_id: 'dQw4w9WgXcQ',
  duracao: '06:24',
  tempo_leitura: null,
  capa_url: null,
  publico: false,
  turmas: [{ id: 5, nome: '8º Ano A' }],
  status: 'publicado',
  permitir_concluir: false,
  visualizacoes: 128,
  criado_em: '2026-09-02T12:00:00Z',
  ...extras,
})

const pagina = (results, count = results.length) => ({ count, results })
const RESUMO = { publicados: 12, rascunhos: 3, videos: 5, documentos: 7, artigos: 3 }
const DISCIPLINAS = [{ id: 3, nome: 'Ciências' }]
const TURMAS = [
  { id: 5, nome: '8º Ano A', codigo: 'ABC234', alunos_total: 2 },
  { id: 6, nome: '9º Ano A', codigo: 'XYZ789', alunos_total: 0 },
]

const rotasLista = (extras = {}) => ({
  'GET /materiais/resumo/': [200, RESUMO],
  'GET /disciplinas/': [200, DISCIPLINAS],
  ...extras,
})

describe('Materiais de estudo (professor)', () => {
  it('mostra números, cartões e filtra', async () => {
    const usuarioEvento = userEvent.setup()
    const chamadas = logarComo(
      PROFESSOR,
      rotasLista({
        'GET /materiais/': [
          200,
          pagina([material(1, { titulo: 'Sistema Solar' }), material(2, { titulo: 'Revolução Industrial', tipo: 'artigo', status: 'rascunho', visualizacoes: 0 })], 2),
        ],
      }),
    )
    renderizarApp('/adm/materiais')

    expect(await screen.findByRole('heading', { name: 'Sistema Solar' })).toBeInTheDocument()
    const resumo = screen.getByRole('region', { name: 'Resumo dos materiais' })
    expect(within(resumo).getByText('12')).toBeInTheDocument()
    expect(within(resumo).getByText('Documentos')).toBeInTheDocument()
    expect(screen.getByText('2 materiais encontrados')).toBeInTheDocument()
    expect(screen.getByText('128 visualizações')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tirar do ar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver como o estudante: Sistema Solar' })).toHaveAttribute('href', '/materiais/1')

    await usuarioEvento.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'artigo')
    await waitFor(() => expect(chamadas.at(-1).consulta).toEqual(expect.objectContaining({ tipo: 'artigo' })))
  })

  it('estado vazio com filtro e sem materiais', async () => {
    logarComo(PROFESSOR, rotasLista({ 'GET /materiais/': [200, pagina([])] }))
    renderizarApp('/adm/materiais?busca=nada')
    expect(await screen.findByRole('heading', { name: 'Nenhum material encontrado' })).toBeInTheDocument()
    expect(screen.getByText('Ajuste os termos ou limpe os filtros.')).toBeInTheDocument()
  })

  it('mostra o erro da lista e deixa tentar de novo', async () => {
    logarComo(PROFESSOR, rotasLista({ 'GET /materiais/': [500, {}] }))
    renderizarApp('/adm/materiais')
    expect(await screen.findByRole('alert')).toHaveTextContent('O Sabiá teve um problema')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('publicar sem turma mostra o motivo', async () => {
    const usuarioEvento = userEvent.setup()
    logarComo(
      PROFESSOR,
      rotasLista({
        'GET /materiais/': [200, pagina([material(2, { titulo: 'Rascunho', status: 'rascunho', turmas: [] })])],
        'PATCH /materiais/2/': [400, { turmas_ids: ['Escolha ao menos uma turma ou deixe o material público.'] }],
      }),
    )
    renderizarApp('/adm/materiais')
    await usuarioEvento.click(await screen.findByRole('button', { name: 'Publicar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Escolha ao menos uma turma ou deixe o material público.')
  })

  it('exclui com confirmação', async () => {
    const usuarioEvento = userEvent.setup()
    const chamadas = logarComo(
      PROFESSOR,
      rotasLista({ 'GET /materiais/': [200, pagina([material(1)])], 'DELETE /materiais/1/': [204, null] }),
    )
    renderizarApp('/adm/materiais')
    await usuarioEvento.click(await screen.findByRole('button', { name: 'Excluir: Material 1' }))
    const dialogo = screen.getByRole('dialog', { name: 'Excluir material?' })
    await usuarioEvento.click(within(dialogo).getByRole('button', { name: 'Excluir material' }))
    expect(await screen.findByText('Material excluído.')).toBeInTheDocument()
    expect(chamadas.some((c) => c.metodo === 'DELETE' && c.caminho === '/materiais/1/')).toBe(true)
  })
})

describe('Novo material', () => {
  const rotasEditor = (extras = {}) => ({
    'GET /disciplinas/': [200, DISCIPLINAS],
    'GET /turmas/': [200, TURMAS],
    ...extras,
  })

  it('valida os campos antes de enviar', async () => {
    const usuarioEvento = userEvent.setup()
    const chamadas = logarComo(PROFESSOR, rotasEditor())
    renderizarApp('/adm/materiais/novo')

    await usuarioEvento.click(await screen.findByRole('button', { name: 'Publicar material' }))
    expect(screen.getByText('Dê um título para o material.')).toBeInTheDocument()
    expect(screen.getByText('Escolha a disciplina.')).toBeInTheDocument()
    expect(screen.getByText('Envie o arquivo do material.')).toBeInTheDocument()
    expect(screen.getByText('Escolha ao menos uma turma ou deixe o material público.')).toBeInTheDocument()
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false)

    await usuarioEvento.selectOptions(screen.getByLabelText('Tipo de material *'), 'video')
    await usuarioEvento.type(screen.getByLabelText('URL do vídeo *'), 'youtube')
    await usuarioEvento.type(screen.getByLabelText(/Duração/), '8')
    await usuarioEvento.click(screen.getByRole('button', { name: 'Publicar material' }))
    expect(screen.getByText('Digite um link completo, começando com https://')).toBeInTheDocument()
    expect(screen.getByText('Use o formato mm:ss (ex.: 08:30).')).toBeInTheDocument()
  })

  it('envia um PDF para a turma e atualiza a pré-visualização', async () => {
    const usuarioEvento = userEvent.setup({ applyAccept: false })
    const chamadas = logarComo(
      PROFESSOR,
      rotasEditor({ 'POST /materiais/': [201, material(9, { titulo: 'Lista', status: 'publicado' })], 'GET /materiais/': [200, pagina([])], 'GET /materiais/resumo/': [200, RESUMO] }),
    )
    renderizarApp('/adm/materiais/novo')

    await usuarioEvento.type(await screen.findByLabelText('Título do material *'), 'Lista de exercícios')
    const previa = screen.getByRole('complementary', { name: 'Pré-visualização' })
    expect(within(previa).getByText('Lista de exercícios')).toBeInTheDocument()
    await usuarioEvento.selectOptions(screen.getByLabelText('Disciplina *'), '3')
    expect(within(previa).getByText('Ciências')).toBeInTheDocument()
    const arquivo = new File(['%PDF'], 'lista.pdf', { type: 'application/pdf' })
    await usuarioEvento.upload(screen.getByLabelText('Arquivo do material'), arquivo)
    expect(screen.getByText('lista.pdf')).toBeInTheDocument()
    await usuarioEvento.click(screen.getByRole('checkbox', { name: '8º Ano A' }))
    await usuarioEvento.click(screen.getByRole('checkbox', { name: 'Permitir que alunos marquem como concluído' }))
    await usuarioEvento.click(screen.getByRole('button', { name: 'Publicar material' }))

    expect(await screen.findByText('“Lista” foi publicado.')).toBeInTheDocument()
    const envio = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/materiais/')
    expect(envio.corpo).toEqual(
      expect.objectContaining({
        titulo: 'Lista de exercícios',
        disciplina: '3',
        tipo: 'documento',
        turmas_ids: '5',
        status: 'publicado',
        permitir_concluir: 'true',
        publico: 'false',
      }),
    )
    expect(envio.formulario.get('arquivo').name).toBe('lista.pdf')
  })

  it('"Todas as minhas turmas" marca todas e o rascunho troca o botão', async () => {
    const usuarioEvento = userEvent.setup()
    logarComo(PROFESSOR, rotasEditor())
    renderizarApp('/adm/materiais/novo')
    await usuarioEvento.click(await screen.findByRole('checkbox', { name: 'Todas as minhas turmas' }))
    expect(screen.getByRole('checkbox', { name: '8º Ano A' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '9º Ano A' })).toBeChecked()
    await usuarioEvento.click(screen.getByRole('radio', { name: 'Salvar como rascunho' }))
    expect(screen.getByRole('button', { name: 'Salvar material' })).toBeInTheDocument()
  })

  it('cadastra uma disciplina pelo modal e já a escolhe', async () => {
    const usuarioEvento = userEvent.setup()
    logarComo(PROFESSOR, rotasEditor({ 'POST /disciplinas/': [201, { id: 8, nome: 'Geografia' }] }))
    renderizarApp('/adm/materiais/novo')
    await usuarioEvento.type(await screen.findByLabelText('Título do material *'), 'Relevo')
    await usuarioEvento.selectOptions(screen.getByLabelText('Disciplina *'), '+ Cadastrar disciplina')
    const dialogo = screen.getByRole('dialog', { name: 'Cadastrar disciplina' })
    await usuarioEvento.click(within(dialogo).getByRole('button', { name: 'Cadastrar disciplina' }))
    expect(within(dialogo).getByText('Digite o nome da disciplina.')).toBeInTheDocument()
    await usuarioEvento.type(within(dialogo).getByLabelText('Nome da disciplina *'), 'Geografia')
    await usuarioEvento.click(within(dialogo).getByRole('button', { name: 'Cadastrar disciplina' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Disciplina *')).toHaveValue('8')
    // Enviar o modal não envia (nem limpa) o formulário do material por trás dele.
    expect(screen.getByLabelText('Título do material *')).toHaveValue('Relevo')
    expect(screen.queryByText('Confira os campos destacados.')).not.toBeInTheDocument()
  })

  it('sem turmas, aponta para a tela de turmas', async () => {
    logarComo(PROFESSOR, rotasEditor({ 'GET /turmas/': [200, []] }))
    renderizarApp('/adm/materiais/novo')
    expect(await screen.findByRole('link', { name: 'Crie uma turma' })).toHaveAttribute('href', '/adm/turmas')
    expect(screen.getByRole('checkbox', { name: /Público/ })).toBeInTheDocument()
  })

  it('edita um material existente e mostra erro do servidor no campo', async () => {
    const usuarioEvento = userEvent.setup()
    logarComo(
      PROFESSOR,
      rotasEditor({
        'GET /materiais/4/': [200, material(4, { titulo: 'Sistema Solar' })],
        'PATCH /materiais/4/': [400, { url: ['Cole o link do vídeo.'] }],
      }),
    )
    renderizarApp('/adm/materiais/4/editar')
    expect(await screen.findByLabelText('Título do material *')).toHaveValue('Sistema Solar')
    expect(screen.getByRole('heading', { name: 'Editar material' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Duração/)).toHaveValue('06:24')
    expect(screen.getByRole('checkbox', { name: '8º Ano A' })).toBeChecked()
    await usuarioEvento.click(screen.getByRole('button', { name: 'Publicar material' }))
    expect(await screen.findByText('Cole o link do vídeo.')).toBeInTheDocument()
  })

  it('material que não existe mais', async () => {
    logarComo(PROFESSOR, rotasEditor({ 'GET /materiais/99/': [404, { detail: 'Não encontrado.' }] }))
    renderizarApp('/adm/materiais/99/editar')
    expect(await screen.findByRole('alert')).toHaveTextContent('Este material não existe mais.')
  })
})

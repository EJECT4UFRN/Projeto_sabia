import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { logarComo, PROFESSOR, renderizarApp } from '../../../testes/auxiliares'
import { tempoRelativo } from '../../../utilitarios/tempoRelativo'
import { validarPergunta } from './validacaoPergunta'

const CATEGORIAS = [
  { id: 1, nome: 'Economia Circular' },
  { id: 2, nome: 'Energia Solar' },
]

const DOIS_DIAS_ATRAS = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

function pergunta(extras = {}) {
  return {
    id: 7,
    texto: 'O que é o efeito fotovoltaico?',
    alternativa_a: 'Reação química que gera calor',
    alternativa_b: 'Conversão da luz solar em energia elétrica',
    alternativa_c: 'Armazenamento de energia em baterias',
    alternativa_d: 'Reciclagem de painéis usados',
    resposta_correta: 'B',
    categoria: 2,
    categoria_nome: 'Energia Solar',
    dificuldade: 'facil',
    tempo_limite: 20,
    pontuacao_maxima: 1000,
    imagem: null,
    ativa: true,
    criada_em: DOIS_DIAS_ATRAS,
    atualizada_em: DOIS_DIAS_ATRAS,
    ...extras,
  }
}

function pagina(perguntas, count = perguntas.length) {
  return { count, results: perguntas }
}

function abrirBanco(rotas = {}, rota = '/adm/perguntas') {
  const chamadas = logarComo(PROFESSOR, {
    'GET /categorias/': [200, CATEGORIAS],
    'GET /perguntas/': [200, pagina([pergunta()])],
    ...rotas,
  })
  renderizarApp(rota)
  return chamadas
}

const listagens = (chamadas) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/perguntas/')

describe('Banco de perguntas', () => {
  it('lista as perguntas com categoria, dificuldade, status e quando foi atualizada', async () => {
    abrirBanco({
      'GET /perguntas/': [
        200,
        pagina([pergunta(), pergunta({ id: 8, texto: 'Pergunta sem tema', categoria: null, categoria_nome: null, ativa: false, dificuldade: 'dificil' })], 86),
      ],
    })

    const linha = (await screen.findByText('O que é o efeito fotovoltaico?')).closest('tr')
    expect(within(linha).getByText('Energia Solar')).toBeInTheDocument()
    expect(within(linha).getByText('Fácil')).toBeInTheDocument()
    expect(within(linha).getByText('Ativa')).toBeInTheDocument()
    expect(within(linha).getByText('2 dias atrás')).toBeInTheDocument()

    const outra = screen.getByText('Pergunta sem tema').closest('tr')
    expect(within(outra).getByText('Sem categoria')).toBeInTheDocument()
    expect(within(outra).getByText('Inativa')).toBeInTheDocument()

    expect(screen.getByText(/Exibindo/)).toHaveTextContent('Exibindo 1–2 de 86 perguntas')
    expect(screen.getByRole('link', { name: 'Editar: O que é o efeito fotovoltaico?' })).toHaveAttribute(
      'href',
      '/adm/perguntas/7/editar',
    )
  })

  it('aplica busca, categoria e nível só ao clicar em Filtrar', async () => {
    const usuario = userEvent.setup()
    const chamadas = abrirBanco()
    await screen.findByText('O que é o efeito fotovoltaico?')

    await usuario.type(screen.getByLabelText('Busca rápida'), 'energia')
    await usuario.selectOptions(screen.getByLabelText('Categoria'), 'Energia Solar')
    await usuario.selectOptions(screen.getByLabelText('Nível'), 'Fácil')
    expect(listagens(chamadas)).toHaveLength(1)

    await usuario.click(screen.getByRole('button', { name: 'Filtrar' }))

    await waitFor(() => expect(listagens(chamadas)).toHaveLength(2))
    expect(listagens(chamadas)[1].consulta).toEqual({ busca: 'energia', categoria: '2', dificuldade: 'facil', pagina: '1' })
  })

  it('troca de página pela paginação', async () => {
    const usuario = userEvent.setup()
    const chamadas = abrirBanco({ 'GET /perguntas/': [200, pagina([pergunta()], 25)] })
    await screen.findByText('O que é o efeito fotovoltaico?')

    await usuario.click(screen.getByRole('button', { name: 'Página 2' }))

    await waitFor(() => expect(listagens(chamadas).at(-1).consulta.pagina).toBe('2'))
    expect(await screen.findByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeInTheDocument()
  })

  it('mostra o estado vazio com convite para criar a primeira pergunta', async () => {
    abrirBanco({ 'GET /perguntas/': [200, pagina([])] })

    expect(await screen.findByText('Seu banco de perguntas está vazio')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Adicionar pergunta' })).toHaveLength(2)
  })

  it('sem resultados para o filtro, oferece limpar os filtros', async () => {
    const usuario = userEvent.setup()
    const chamadas = abrirBanco({ 'GET /perguntas/': [200, pagina([])] }, '/adm/perguntas?busca=xyz')

    await usuario.click(await screen.findByRole('button', { name: 'Limpar filtros' }))

    await waitFor(() => expect(listagens(chamadas).at(-1).consulta).toEqual({ pagina: '1' }))
    expect(screen.getByLabelText('Busca rápida')).toHaveValue('')
  })

  it('mostra o erro de carregamento e tenta de novo', async () => {
    const usuario = userEvent.setup()
    let tentativas = 0
    abrirBanco({
      'GET /perguntas/': () => (++tentativas === 1 ? [500, null] : [200, pagina([pergunta()])]),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('O Sabiá teve um problema')
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('O que é o efeito fotovoltaico?')).toBeInTheDocument()
  })

  it('exclui a pergunta depois de confirmar', async () => {
    const usuario = userEvent.setup()
    let excluida = false
    const chamadas = abrirBanco({
      'GET /perguntas/': () => [200, pagina(excluida ? [] : [pergunta()])],
      'DELETE /perguntas/7/': () => {
        excluida = true
        return [204, null]
      },
    })

    await usuario.click(await screen.findByRole('button', { name: 'Excluir: O que é o efeito fotovoltaico?' }))
    const dialogo = screen.getByRole('dialog', { name: 'Excluir pergunta?' })
    expect(dialogo).toHaveTextContent('“O que é o efeito fotovoltaico?” será apagada')

    await usuario.click(within(dialogo).getByRole('button', { name: 'Excluir pergunta' }))

    expect(await screen.findByText('Pergunta excluída.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chamadas.some((c) => c.metodo === 'DELETE' && c.caminho === '/perguntas/7/')).toBe(true)
    expect(await screen.findByText('Seu banco de perguntas está vazio')).toBeInTheDocument()
  })

  it('cancelar a exclusão não apaga nada', async () => {
    const usuario = userEvent.setup()
    const chamadas = abrirBanco()

    await usuario.click(await screen.findByRole('button', { name: 'Excluir: O que é o efeito fotovoltaico?' }))
    await usuario.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chamadas.some((c) => c.metodo === 'DELETE')).toBe(false)
  })
})

describe('Criar e editar pergunta', () => {
  async function preencherNova(usuario) {
    await usuario.type(screen.getByLabelText(/Texto da pergunta/), 'Qual planeta é o Planeta Vermelho?')
    await usuario.type(screen.getByLabelText('Alternativa A', { exact: true }), 'Marte')
    await usuario.type(screen.getByLabelText('Alternativa B', { exact: true }), 'Vênus')
    await usuario.type(screen.getByLabelText('Alternativa C', { exact: true }), 'Júpiter')
    await usuario.type(screen.getByLabelText('Alternativa D', { exact: true }), 'Saturno')
  }

  it('cria a pergunta e volta ao banco com aviso', async () => {
    const usuario = userEvent.setup()
    const chamadas = abrirBanco({ 'POST /perguntas/': [201, pergunta({ id: 9 })] }, '/adm/perguntas/nova')
    expect(await screen.findByRole('heading', { name: 'Nova pergunta' })).toBeInTheDocument()

    await preencherNova(usuario)
    await usuario.click(screen.getByRole('radio', { name: 'Marcar A como correta' }))
    await usuario.selectOptions(screen.getByLabelText('Categoria'), 'Energia Solar')
    await usuario.selectOptions(screen.getByLabelText('Dificuldade'), 'Difícil')
    await usuario.clear(screen.getByLabelText('Tempo limite (segundos)'))
    await usuario.type(screen.getByLabelText('Tempo limite (segundos)'), '30')
    await usuario.click(screen.getByRole('button', { name: 'Criar pergunta' }))

    expect(await screen.findByText('Pergunta criada.')).toBeInTheDocument()
    const envio = chamadas.find((c) => c.metodo === 'POST')
    expect(envio.corpo).toEqual({
      texto: 'Qual planeta é o Planeta Vermelho?',
      alternativa_a: 'Marte',
      alternativa_b: 'Vênus',
      alternativa_c: 'Júpiter',
      alternativa_d: 'Saturno',
      resposta_correta: 'A',
      categoria: 2,
      dificuldade: 'dificil',
      tempo_limite: 30,
      pontuacao_maxima: 1000,
      ativa: true,
    })
  })

  it('clicar na área da opção também marca a correta', async () => {
    const usuario = userEvent.setup()
    abrirBanco({}, '/adm/perguntas/nova')

    const radioC = await screen.findByRole('radio', { name: 'Marcar C como correta' })
    const opcaoC = screen.getByLabelText('Alternativa C', { exact: true }).closest('div')
    await usuario.click(opcaoC.querySelector('[title="Marcar como correta"]'))
    expect(radioC).toBeChecked()
    expect(opcaoC.querySelector('[title="Resposta correta"]')).toBeInTheDocument()

    // Clicar no texto da alternativa só edita, não muda a correta.
    await usuario.click(screen.getByLabelText('Alternativa D', { exact: true }))
    expect(radioC).toBeChecked()
  })

  it('não envia sem os campos obrigatórios e mostra o que falta', async () => {
    const usuario = userEvent.setup()
    const chamadas = abrirBanco({}, '/adm/perguntas/nova')

    await usuario.click(await screen.findByRole('button', { name: 'Criar pergunta' }))

    expect(screen.getByText('Confira os campos destacados.')).toBeInTheDocument()
    expect(screen.getByText('Escreva o texto da pergunta.')).toBeInTheDocument()
    expect(screen.getAllByText('Preencha esta alternativa.')).toHaveLength(4)
    expect(screen.getByText('Marque qual alternativa é a correta.')).toBeInTheDocument()
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false)
  })

  it('mostra no campo os erros que vierem do servidor', async () => {
    const usuario = userEvent.setup()
    abrirBanco(
      { 'POST /perguntas/': [400, { pontuacao_maxima: ['A pontuação máxima é 2000.'] }] },
      '/adm/perguntas/nova',
    )
    await screen.findByRole('heading', { name: 'Nova pergunta' })

    await preencherNova(usuario)
    await usuario.click(screen.getByRole('radio', { name: 'Marcar B como correta' }))
    await usuario.click(screen.getByRole('button', { name: 'Criar pergunta' }))

    expect(await screen.findByText('A pontuação máxima é 2000.')).toBeInTheDocument()
    expect(screen.getByLabelText('Pontuação máxima')).toHaveAttribute('aria-invalid', 'true')
  })

  it('carrega a pergunta para edição e salva as alterações', async () => {
    const usuario = userEvent.setup()
    const chamadas = abrirBanco(
      {
        'GET /perguntas/7/': [200, pergunta()],
        'PATCH /perguntas/7/': [200, pergunta({ resposta_correta: 'D', ativa: false })],
      },
      '/adm/perguntas/7/editar',
    )

    expect(await screen.findByDisplayValue('O que é o efeito fotovoltaico?')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Marcar B como correta' })).toBeChecked()
    expect(screen.getByLabelText('Categoria')).toHaveValue('2')
    expect(screen.getByRole('link', { name: 'Banco de Perguntas' })).toHaveAttribute('href', '/adm/perguntas')

    await usuario.click(screen.getByRole('radio', { name: 'Marcar D como correta' }))
    await usuario.click(screen.getByLabelText('Pergunta ativa'))
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument()
    const envio = chamadas.find((c) => c.metodo === 'PATCH')
    expect(envio.corpo).toMatchObject({ resposta_correta: 'D', ativa: false, categoria: 2 })
  })

  it('avisa quando a pergunta não existe', async () => {
    abrirBanco({ 'GET /perguntas/99/': [404, { detail: 'Não encontrado.' }] }, '/adm/perguntas/99/editar')

    expect(await screen.findByText('Esta pergunta não existe ou foi excluída.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Voltar ao banco de perguntas' })).toBeInTheDocument()
  })

  it('cria uma categoria nova e já a seleciona', async () => {
    const usuario = userEvent.setup()
    const chamadas = abrirBanco({ 'POST /categorias/': [201, { id: 3, nome: 'Astronomia' }] }, '/adm/perguntas/nova')

    await usuario.click(await screen.findByRole('button', { name: 'Nova categoria' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nova categoria' })
    await usuario.type(within(dialogo).getByLabelText('Nome da categoria'), 'Astronomia')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar categoria' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Categoria')).toHaveValue('3')
    expect(chamadas.find((c) => c.caminho === '/categorias/' && c.metodo === 'POST').corpo).toEqual({
      nome: 'Astronomia',
    })
  })

  it('mostra o erro de categoria repetida dentro da janela', async () => {
    const usuario = userEvent.setup()
    abrirBanco(
      { 'POST /categorias/': [400, { nome: ['Você já tem uma categoria com esse nome.'] }] },
      '/adm/perguntas/nova',
    )

    await usuario.click(await screen.findByRole('button', { name: 'Nova categoria' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nova categoria' })
    await usuario.type(within(dialogo).getByLabelText('Nome da categoria'), 'energia solar')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar categoria' }))

    expect(await within(dialogo).findByText('Você já tem uma categoria com esse nome.')).toBeInTheDocument()
  })

  it('envia a imagem escolhida como formulário', async () => {
    const usuario = userEvent.setup()
    URL.createObjectURL = vi.fn(() => 'blob:previa')
    URL.revokeObjectURL = vi.fn()
    const chamadas = abrirBanco({ 'POST /perguntas/': [201, pergunta({ id: 9 })] }, '/adm/perguntas/nova')
    await screen.findByRole('heading', { name: 'Nova pergunta' })

    await preencherNova(usuario)
    await usuario.click(screen.getByRole('radio', { name: 'Marcar A como correta' }))
    const arquivo = new File(['png'], 'marte.png', { type: 'image/png' })
    await usuario.upload(screen.getByLabelText('Escolher imagem da pergunta'), arquivo)
    expect(screen.getByRole('img', { name: 'Imagem da pergunta' })).toHaveAttribute('src', 'blob:previa')

    await usuario.click(screen.getByRole('button', { name: 'Criar pergunta' }))

    await screen.findByText('Pergunta criada.')
    const envio = chamadas.find((c) => c.metodo === 'POST')
    expect(envio.formulario.get('imagem').name).toBe('marte.png')
    expect(envio.corpo).toMatchObject({ texto: 'Qual planeta é o Planeta Vermelho?', resposta_correta: 'A', categoria: '' })
  })

  it('recusa arquivo que não é imagem', async () => {
    const usuario = userEvent.setup({ applyAccept: false })
    abrirBanco({}, '/adm/perguntas/nova')

    const pdf = new File(['%PDF'], 'prova.pdf', { type: 'application/pdf' })
    await usuario.upload(await screen.findByLabelText('Escolher imagem da pergunta'), pdf)

    expect(screen.getByText('Use uma imagem JPG, PNG, WEBP ou GIF.')).toBeInTheDocument()
  })
})

describe('Regras da pergunta no navegador', () => {
  const base = {
    texto: 'Pergunta',
    alternativa_a: 'Um',
    alternativa_b: 'Dois',
    alternativa_c: 'Três',
    alternativa_d: 'Quatro',
    resposta_correta: 'A',
    tempo_limite: '20',
    pontuacao_maxima: '1000',
  }

  it('aceita uma pergunta completa', () => {
    expect(validarPergunta(base)).toEqual({})
  })

  it('aponta alternativa repetida, ignorando maiúsculas e espaços', () => {
    expect(validarPergunta({ ...base, alternativa_d: '  um ' })).toEqual({
      alternativa_d: 'Esta alternativa repete outra. Cada opção precisa ser diferente.',
    })
  })

  it.each([
    ['tempo_limite', '4'],
    ['tempo_limite', '301'],
    ['tempo_limite', '2.5'],
    ['pontuacao_maxima', '99'],
    ['pontuacao_maxima', '2001'],
  ])('recusa %s = %s', (campo, valor) => {
    expect(validarPergunta({ ...base, [campo]: valor })).toHaveProperty(campo)
  })
})

describe('Tempo relativo', () => {
  const agora = new Date('2026-10-16T12:00:00Z')

  it.each([
    ['2026-10-16T11:59:50Z', 'agora mesmo'],
    ['2026-10-16T11:55:00Z', '5 minutos atrás'],
    ['2026-10-14T12:00:00Z', '2 dias atrás'],
    ['2026-10-09T12:00:00Z', '1 semana atrás'],
  ])('%s → %s', (data, esperado) => {
    expect(tempoRelativo(data, agora)).toBe(esperado)
  })
})

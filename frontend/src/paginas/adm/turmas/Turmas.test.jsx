import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { logarComo, PROFESSOR, renderizarApp } from '../../../testes/auxiliares'

const aluno = (id, nome, extras = {}) => ({
  id,
  nome,
  username: nome.toLowerCase().replace(/\s+/g, ''),
  iniciais: nome.slice(0, 2).toUpperCase(),
  cor_avatar: 'azul',
  ...extras,
})

const turma = (extras = {}) => ({ id: 5, nome: '8º Ano A', codigo: 'ABC234', alunos_total: 1, alunos: [aluno(11, 'Ana Lima')], ...extras })

describe('Turmas', () => {
  it('lista as turmas com código e quantidade de alunos', async () => {
    logarComo(PROFESSOR, { 'GET /turmas/': [200, [{ id: 5, nome: '8º Ano A', codigo: 'ABC234', alunos_total: 2 }]] })
    renderizarApp('/adm/turmas')
    const cartao = await screen.findByRole('link', { name: /8º Ano A/ })
    expect(cartao).toHaveAttribute('href', '/adm/turmas/5')
    expect(cartao).toHaveTextContent('2 alunos · código ABC234')
  })

  it('cria uma turma pelo modal e abre ela', async () => {
    const usuarioEvento = userEvent.setup()
    logarComo(PROFESSOR, {
      'GET /turmas/': [200, []],
      'POST /turmas/': (corpo) =>
        corpo.nome === '8º Ano A'
          ? [400, { nome: ['Você já tem uma turma com esse nome.'] }]
          : [201, turma({ id: 6, nome: corpo.nome, alunos: [], alunos_total: 0 })],
      'GET /turmas/6/': [200, turma({ id: 6, nome: '9º Ano B', alunos: [], alunos_total: 0 })],
    })
    renderizarApp('/adm/turmas')
    expect(await screen.findByRole('heading', { name: 'Você ainda não tem turmas' })).toBeInTheDocument()
    await usuarioEvento.click(screen.getAllByRole('button', { name: 'Nova turma' })[0])
    const dialogo = screen.getByRole('dialog', { name: 'Nova turma' })
    await usuarioEvento.type(within(dialogo).getByLabelText('Nome da turma *'), '8º Ano A')
    await usuarioEvento.click(within(dialogo).getByRole('button', { name: 'Criar turma' }))
    expect(await within(dialogo).findByText('Você já tem uma turma com esse nome.')).toBeInTheDocument()
    await usuarioEvento.clear(within(dialogo).getByLabelText('Nome da turma *'))
    await usuarioEvento.type(within(dialogo).getByLabelText('Nome da turma *'), '9º Ano B')
    await usuarioEvento.click(within(dialogo).getByRole('button', { name: 'Criar turma' }))
    expect(await screen.findByText('Turma “9º Ano B” criada.')).toBeInTheDocument()
    expect(screen.getByText(/Ninguém na turma ainda/)).toBeInTheDocument()
  })

  it('busca, adiciona e tira alunos', async () => {
    const usuarioEvento = userEvent.setup()
    logarComo(PROFESSOR, {
      'GET /turmas/5/': [200, turma()],
      'GET /alunos/': (_, consulta) => [200, consulta.busca === 'be' ? [aluno(12, 'Beto Souza'), aluno(11, 'Ana Lima')] : []],
      'POST /turmas/5/alunos/': [200, turma({ alunos_total: 2, alunos: [aluno(11, 'Ana Lima'), aluno(12, 'Beto Souza')] })],
      'DELETE /turmas/5/alunos/11/': [200, turma({ alunos_total: 1, alunos: [aluno(12, 'Beto Souza')] })],
    })
    renderizarApp('/adm/turmas/5')

    expect(await screen.findByText('ABC234')).toBeInTheDocument()
    await usuarioEvento.type(screen.getByLabelText('Adicionar aluno'), 'be')
    const encontrados = await screen.findByRole('list', { name: 'Alunos encontrados' })
    expect(within(encontrados).getByText('Na turma')).toBeInTheDocument()
    await usuarioEvento.click(within(encontrados).getByRole('button', { name: 'Adicionar Beto Souza' }))
    expect(await screen.findByText('Beto Souza entrou na turma.')).toBeInTheDocument()

    const daTurma = screen.getByRole('list', { name: 'Alunos da turma' })
    await usuarioEvento.click(within(daTurma).getByRole('button', { name: 'Tirar Ana Lima da turma' }))
    expect(await screen.findByText('Ana Lima saiu da turma.')).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Alunos da turma' })).queryByText('Ana Lima')).not.toBeInTheDocument())
  })

  it('gera um novo código', async () => {
    const usuarioEvento = userEvent.setup()
    logarComo(PROFESSOR, {
      'GET /turmas/5/': [200, turma()],
      'POST /turmas/5/novo_codigo/': [200, turma({ codigo: 'QWE456' })],
    })
    renderizarApp('/adm/turmas/5')
    await usuarioEvento.click(await screen.findByRole('button', { name: 'Gerar novo código' }))
    expect(await screen.findByText('Novo código: QWE456. O anterior não funciona mais.')).toBeInTheDocument()
  })

  it('exclui a turma e volta para a lista', async () => {
    const usuarioEvento = userEvent.setup()
    logarComo(PROFESSOR, {
      'GET /turmas/5/': [200, turma()],
      'DELETE /turmas/5/': [204, null],
      'GET /turmas/': [200, []],
    })
    renderizarApp('/adm/turmas/5')
    await usuarioEvento.click(await screen.findByRole('button', { name: 'Excluir turma' }))
    const dialogo = screen.getByRole('dialog', { name: 'Excluir turma?' })
    await usuarioEvento.click(within(dialogo).getByRole('button', { name: 'Excluir turma' }))
    expect(await screen.findByText('Turma “8º Ano A” excluída.')).toBeInTheDocument()
  })

  it('turma que não existe', async () => {
    logarComo(PROFESSOR, { 'GET /turmas/9/': [404, { detail: 'Não encontrado.' }] })
    renderizarApp('/adm/turmas/9')
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta turma não existe mais.')
  })
})

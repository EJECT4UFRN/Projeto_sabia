import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ESTUDANTE, logarComo, PROFESSOR, renderizarApp, simularApi } from '../../testes/auxiliares'
import CabecalhoEstudante from './CabecalhoEstudante'

describe('Cabeçalho do estudante', () => {
  it('marca o link da página atual como ativo', async () => {
    logarComo(ESTUDANTE)
    renderizarApp('/materiais')

    const navegacao = await screen.findByRole('navigation', { name: 'Navegação principal' })
    expect(within(navegacao).getByRole('link', { name: 'Materiais' })).toHaveAttribute('aria-current', 'page')
  })

  it('abre e fecha o menu mobile pelo botão e pela tecla Esc', async () => {
    const usuario = userEvent.setup()
    render(
      <MemoryRouter>
        <CabecalhoEstudante />
      </MemoryRouter>,
    )

    const botao = screen.getByRole('button', { name: 'Abrir menu' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')

    await usuario.click(botao)
    expect(screen.getByRole('link', { name: 'Digitar PIN' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')

    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('link', { name: 'Digitar PIN' })).not.toBeInTheDocument()
  })

  it('só mostra "Sair da conta" quando há ação de sair', async () => {
    const usuario = userEvent.setup()
    const aoSair = vi.fn()
    render(
      <MemoryRouter>
        <CabecalhoEstudante aoSair={aoSair} />
      </MemoryRouter>,
    )

    await usuario.click(screen.getByRole('button', { name: 'Abrir menu' }))
    await usuario.click(screen.getByRole('button', { name: 'Sair da conta' }))

    expect(aoSair).toHaveBeenCalledOnce()
  })
})

describe('Rotas', () => {
  it('redireciona a raiz para a tela de entrar', () => {
    simularApi()
    renderizarApp('/')
    expect(screen.getAllByRole('heading', { name: 'Entrar na conta' }).length).toBeGreaterThan(0)
  })

  it('manda quem não está logado para a tela de entrar', () => {
    simularApi()
    renderizarApp('/historico')
    expect(screen.getAllByRole('heading', { name: 'Entrar na conta' }).length).toBeGreaterThan(0)
  })

  it('mostra a barra inferior apenas nas telas do estudante logado', async () => {
    logarComo(ESTUDANTE)
    const { unmount } = renderizarApp('/historico')
    expect(await screen.findByRole('navigation', { name: 'Navegação do estudante' })).toBeInTheDocument()
    unmount()

    simularApi()
    renderizarApp('/criar-conta')
    expect(screen.queryByRole('navigation', { name: 'Navegação do estudante' })).not.toBeInTheDocument()
  })
})

describe('Painel do professor', () => {
  it('não deixa estudante entrar no painel', async () => {
    logarComo(ESTUDANTE)
    renderizarApp('/adm')
    expect(await screen.findByRole('heading', { name: 'Jogar' })).toBeInTheDocument()
  })

  it('destaca só o Dashboard na raiz do painel e mostra o professor', async () => {
    logarComo(PROFESSOR)
    renderizarApp('/adm')

    expect(await screen.findByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Perguntas' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Prof. Állex Thierry')).toBeInTheDocument()
  })

  it('abre o menu lateral no mobile e fecha ao navegar', async () => {
    const usuario = userEvent.setup()
    logarComo(PROFESSOR)
    renderizarApp('/adm')

    await usuario.click(await screen.findByRole('button', { name: 'Abrir menu' }))
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('link', { name: 'Perguntas' }))
    expect(screen.queryByRole('button', { name: 'Fechar menu' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Banco de perguntas' })).toBeInTheDocument()
  })

  it('sair do painel encerra a sessão e volta para a tela de entrar do professor', async () => {
    const usuario = userEvent.setup()
    const chamadas = logarComo(PROFESSOR)
    renderizarApp('/adm')

    await usuario.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findAllByRole('heading', { name: 'Entrar no painel' })).not.toHaveLength(0)
    expect(chamadas.some((c) => c.caminho === '/auth/sair/' && c.corpo.refresh === 'token-renovacao')).toBe(true)
    expect(sessionStorage.getItem('sabia.tokens')).toBeNull()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Rotas } from '../../App'
import CabecalhoEstudante from './CabecalhoEstudante'

function renderizarEm(rota, elemento = <Rotas />) {
  return render(<MemoryRouter initialEntries={[rota]}>{elemento}</MemoryRouter>)
}

describe('Cabeçalho do estudante', () => {
  it('marca o link da página atual como ativo', () => {
    renderizarEm('/materiais')

    const navegacao = screen.getByRole('navigation', { name: 'Navegação principal' })
    const linkMateriais = Array.from(navegacao.querySelectorAll('a')).find((a) => a.textContent === 'Materiais')
    expect(linkMateriais).toHaveAttribute('aria-current', 'page')
  })

  it('abre e fecha o menu mobile pelo botão e pela tecla Esc', async () => {
    const usuario = userEvent.setup()
    renderizarEm('/entrar', <CabecalhoEstudante />)

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
    renderizarEm('/perfil', <CabecalhoEstudante aoSair={aoSair} />)

    await usuario.click(screen.getByRole('button', { name: 'Abrir menu' }))
    await usuario.click(screen.getByRole('button', { name: 'Sair da conta' }))

    expect(aoSair).toHaveBeenCalledOnce()
  })
})

describe('Rotas', () => {
  it('redireciona a raiz para a tela de entrar', () => {
    renderizarEm('/')
    expect(screen.getByRole('heading', { name: 'Entrar na conta' })).toBeInTheDocument()
  })

  it('mostra a barra inferior apenas nas telas do estudante logado', () => {
    const { unmount } = renderizarEm('/historico')
    expect(screen.getByRole('navigation', { name: 'Navegação do estudante' })).toBeInTheDocument()
    unmount()

    renderizarEm('/entrar')
    expect(screen.queryByRole('navigation', { name: 'Navegação do estudante' })).not.toBeInTheDocument()
  })
})

describe('Painel do professor', () => {
  it('destaca só o Dashboard na raiz do painel', () => {
    renderizarEm('/adm')

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Perguntas' })).not.toHaveAttribute('aria-current')
  })

  it('abre o menu lateral no mobile e fecha ao navegar', async () => {
    const usuario = userEvent.setup()
    renderizarEm('/adm')

    await usuario.click(screen.getByRole('button', { name: 'Abrir menu' }))
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('link', { name: 'Perguntas' }))
    expect(screen.queryByRole('button', { name: 'Fechar menu' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Banco de perguntas' })).toBeInTheDocument()
  })
})

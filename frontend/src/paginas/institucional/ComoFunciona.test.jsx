import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderizarApp, simularApi } from '../../testes/auxiliares'

describe('Como funciona', () => {
  it('explica os passos, a pontuação e responde as dúvidas', async () => {
    const usuarioEvento = userEvent.setup()
    simularApi()
    renderizarApp('/como-funciona')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Aprender jogando, todo mundo junto.')
    expect(screen.getByRole('heading', { name: 'Em 4 passos você está no jogo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Passo 1:\s*Digite o PIN/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Passo 4:\s*Veja o resultado/ })).toBeInTheDocument()
    expect(screen.getByText('Acertou em sequência')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Entrar com PIN' })).toHaveAttribute('href', '/entrar-pin')
    expect(screen.getByRole('link', { name: 'Criar conta de professor' })).toHaveAttribute(
      'href',
      '/professor/criar-conta',
    )

    const resposta = screen.getByText(/Dá para entrar só com um apelido/)
    expect(resposta).not.toBeVisible()
    await usuarioEvento.click(screen.getByText('Preciso criar uma conta para jogar?'))
    expect(resposta).toBeVisible()
  })
})

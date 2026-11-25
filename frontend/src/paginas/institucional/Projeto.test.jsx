import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderizarApp, simularApi } from '../../testes/auxiliares'

const MATERIAL = {
  id: 7,
  tipo: 'video',
  titulo: 'Como a luz do sol vira energia?',
  descricao: 'Descubra o caminho da luz até a tomada da sua casa.',
  disciplina: 'Ciências',
  capa_url: null,
  duracao: '06:24',
  concluido: false,
}

describe('O projeto (página inicial)', () => {
  it('abre na raiz com o convite, os passos e os materiais em destaque', async () => {
    const chamadas = simularApi({ 'GET /estudo/': [200, { count: 1, results: [MATERIAL] }] })
    renderizarApp('/')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aprender pode ser a melhor jogada')
    const principal = screen.getByRole('main')
    expect(within(principal).getAllByRole('link', { name: 'Entrar com PIN' })[0]).toHaveAttribute('href', '/entrar-pin')
    expect(within(principal).getByRole('link', { name: 'Explorar materiais' })).toHaveAttribute('href', '/materiais')
    expect(screen.getByText('Mossoró')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Passo 1:\s*O educador cria/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Passo 4:\s*Todo mundo evolui/ })).toBeInTheDocument()

    const destaque = await screen.findByRole('list', { name: 'Materiais em destaque' })
    expect(within(destaque).getByRole('link', { name: /Como a luz do sol vira energia/ })).toHaveAttribute(
      'href',
      '/materiais/7',
    )
    expect(chamadas.find((c) => c.caminho === '/estudo/').consulta).toEqual({ por_pagina: '3' })
    expect(screen.getByRole('link', { name: /Ver todos os materiais/ })).toHaveAttribute('href', '/materiais')

    const rodape = screen.getByRole('contentinfo')
    expect(within(rodape).getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/criar-conta')
    expect(within(rodape).getByRole('link', { name: 'sinergy@ufrn.com.br' })).toHaveAttribute(
      'href',
      'mailto:sinergy@ufrn.com.br',
    )
  })

  it('"O projeto" no menu leva para a mesma página', () => {
    simularApi({ 'GET /estudo/': [200, { count: 0, results: [] }] })
    renderizarApp('/o-projeto')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aprender pode ser a melhor jogada')
  })

  it('sem materiais avisa; com erro deixa tentar de novo', async () => {
    const usuarioEvento = userEvent.setup()
    simularApi({ 'GET /estudo/': [200, { count: 0, results: [] }] })
    const { unmount } = renderizarApp('/')
    expect(await screen.findByText(/Os primeiros materiais estão chegando/)).toBeInTheDocument()
    unmount()

    let tentativas = 0
    simularApi({
      'GET /estudo/': () => {
        tentativas += 1
        return tentativas === 1 ? [500, {}] : [200, { count: 1, results: [MATERIAL] }]
      },
    })
    renderizarApp('/')
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os materiais agora.')
    await usuarioEvento.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(screen.getByRole('list', { name: 'Materiais em destaque' })).toBeInTheDocument())
  })
})

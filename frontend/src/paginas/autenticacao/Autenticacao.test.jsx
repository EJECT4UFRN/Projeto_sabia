import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { avaliarSenha } from '../../componentes/formulario/forcaSenha'
import { ESTUDANTE, PROFESSOR, renderizarApp, simularApi } from '../../testes/auxiliares'

const TOKENS = { access: 'novo-acesso', refresh: 'nova-renovacao' }

function formulario() {
  return screen.getAllByRole('button', { name: /^Entrar$|Criar conta|Enviar link|Salvar nova senha/ })[0].closest('form')
}

describe('Tela de entrar', () => {
  it('entra com usuário e senha e vai para a área do estudante', async () => {
    const usuario = userEvent.setup()
    const chamadas = simularApi({ 'POST /auth/entrar/': [200, { ...TOKENS, usuario: ESTUDANTE }] })
    renderizarApp('/entrar')

    await usuario.type(screen.getByLabelText('Usuário ou e-mail'), 'AllexThierry')
    await usuario.type(screen.getByLabelText('Senha'), 'Sabia#Forte2026')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Jogar' })).toBeInTheDocument()
    expect(chamadas[0].corpo).toEqual({ login: 'AllexThierry', senha: 'Sabia#Forte2026' })
    // sem "manter conectado", o token fica só na sessão do navegador
    expect(JSON.parse(sessionStorage.getItem('sabia.tokens')).access).toBe('novo-acesso')
    expect(localStorage.getItem('sabia.tokens')).toBeNull()
  })

  it('com "manter conectado" guarda a sessão de forma persistente', async () => {
    const usuario = userEvent.setup()
    simularApi({ 'POST /auth/entrar/': [200, { ...TOKENS, usuario: ESTUDANTE }] })
    renderizarApp('/entrar')

    await usuario.type(screen.getByLabelText('Usuário ou e-mail'), 'AllexThierry')
    await usuario.type(screen.getByLabelText('Senha'), 'Sabia#Forte2026')
    await usuario.click(screen.getByLabelText('Manter minha conta conectada'))
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    await screen.findByRole('heading', { name: 'Jogar' })
    expect(JSON.parse(localStorage.getItem('sabia.tokens')).manterConectado).toBe(true)
  })

  it('professor vai para o painel depois de entrar', async () => {
    const usuario = userEvent.setup()
    simularApi({ 'POST /auth/entrar/': [200, { ...TOKENS, usuario: PROFESSOR }] })
    renderizarApp('/professor/entrar')

    await usuario.type(screen.getByLabelText('Usuário ou e-mail'), 'prof')
    await usuario.type(screen.getByLabelText('Senha'), 'Sabia#Forte2026')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('volta para a página que a pessoa tentou abrir antes de entrar', async () => {
    const usuario = userEvent.setup()
    simularApi({ 'POST /auth/entrar/': [200, { ...TOKENS, usuario: ESTUDANTE }] })
    renderizarApp('/historico')

    await usuario.type(screen.getByLabelText('Usuário ou e-mail'), 'AllexThierry')
    await usuario.type(screen.getByLabelText('Senha'), 'Sabia#Forte2026')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Meu histórico' })).toBeInTheDocument()
  })

  it('mostra a mensagem da API quando os dados estão errados', async () => {
    const usuario = userEvent.setup()
    simularApi({ 'POST /auth/entrar/': [400, { non_field_errors: ['Usuário, e-mail ou senha incorretos.'] }] })
    renderizarApp('/entrar')

    await usuario.type(screen.getByLabelText('Usuário ou e-mail'), 'AllexThierry')
    await usuario.type(screen.getByLabelText('Senha'), 'errada')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário, e-mail ou senha incorretos.')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('avisa quando o servidor está fora do ar', async () => {
    const usuario = userEvent.setup()
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    renderizarApp('/entrar')

    await usuario.type(screen.getByLabelText('Usuário ou e-mail'), 'AllexThierry')
    await usuario.type(screen.getByLabelText('Senha'), 'qualquer')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar ao Sabiá')
  })

  it('não envia o formulário vazio', async () => {
    const usuario = userEvent.setup()
    const chamadas = simularApi()
    renderizarApp('/entrar')

    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Preencha usuário (ou e-mail) e senha.')
    expect(chamadas).toHaveLength(0)
  })

  it('mostra e oculta a senha', async () => {
    const usuario = userEvent.setup()
    simularApi()
    renderizarApp('/entrar')

    const senha = screen.getByLabelText('Senha')
    expect(senha).toHaveAttribute('type', 'password')
    await usuario.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(senha).toHaveAttribute('type', 'text')
    await usuario.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(senha).toHaveAttribute('type', 'password')
  })
})

describe('Tela de criar conta', () => {
  async function preencher(usuario, { senha = 'Sabia#Forte2026', confirmar = senha } = {}) {
    await usuario.type(screen.getByLabelText(/Nome de usuário/), 'novo_aluno')
    await usuario.type(screen.getByLabelText('E-mail'), 'novo@exemplo.com')
    await usuario.type(screen.getByLabelText(/^Senha/), senha)
    await usuario.type(screen.getByLabelText(/Confirmar senha/), confirmar)
  }

  it('cria a conta de estudante e leva para digitar o PIN', async () => {
    const usuario = userEvent.setup()
    const chamadas = simularApi({ 'POST /auth/cadastro/': [201, { ...TOKENS, usuario: ESTUDANTE }] })
    renderizarApp('/criar-conta')

    await preencher(usuario)
    expect(screen.getByText('Senhas coincidem ✓')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Criar conta e jogar' }))

    expect(await screen.findByRole('heading', { name: 'Entre no jogo. Digite o PIN.' })).toBeInTheDocument()
    expect(chamadas[0].corpo).toMatchObject({ username: 'novo_aluno', perfil: 'estudante' })
  })

  it('cria a conta de professor e leva para o painel', async () => {
    const usuario = userEvent.setup()
    const chamadas = simularApi({ 'POST /auth/cadastro/': [201, { ...TOKENS, usuario: PROFESSOR }] })
    renderizarApp('/professor/criar-conta')

    await preencher(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Criar conta de professor' }))

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(chamadas[0].corpo.perfil).toBe('professor')
  })

  it('avisa na hora quando as senhas não coincidem e não envia', async () => {
    const usuario = userEvent.setup()
    const chamadas = simularApi()
    renderizarApp('/criar-conta')

    await preencher(usuario, { confirmar: 'OutraSenha#1' })
    expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Criar conta e jogar' }))

    expect(chamadas).toHaveLength(0)
  })

  it('mostra os erros de cada campo devolvidos pela API', async () => {
    const usuario = userEvent.setup()
    simularApi({
      'POST /auth/cadastro/': [
        400,
        { username: ['Este nome de usuário já está em uso.'], senha: ['Esta senha é muito comum.'] },
      ],
    })
    renderizarApp('/criar-conta')

    await preencher(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Criar conta e jogar' }))

    expect(await screen.findByText('Este nome de usuário já está em uso.')).toBeInTheDocument()
    expect(screen.getByText('Esta senha é muito comum.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome de usuário/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('o link do rodapé leva ao cadastro do professor', async () => {
    simularApi()
    renderizarApp('/criar-conta')

    expect(screen.getByRole('link', { name: 'Painel administrativo →' })).toHaveAttribute('href', '/professor/entrar')
  })
})

describe('Recuperação de senha', () => {
  it('pede o link e mostra a confirmação', async () => {
    const usuario = userEvent.setup()
    const chamadas = simularApi({ 'POST /auth/esqueci-senha/': [200, { detalhe: 'Enviamos um link.' }] })
    renderizarApp('/esqueci-senha')

    await usuario.type(screen.getByLabelText('Usuário ou e-mail'), 'allex@exemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Enviamos um link.')
    expect(chamadas[0].corpo).toEqual({ login: 'allex@exemplo.com' })
  })

  it('redefine a senha com o uid e o token do link', async () => {
    const usuario = userEvent.setup()
    const chamadas = simularApi({ 'POST /auth/redefinir-senha/': [200, { detalhe: 'Senha alterada.' }] })
    renderizarApp('/redefinir-senha/MQ/abc-123')

    await usuario.type(screen.getByLabelText(/^Nova senha/), 'NovaSenha#Sabia9')
    await usuario.type(screen.getByLabelText(/Confirmar nova senha/), 'NovaSenha#Sabia9')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Senha alterada.')
    expect(chamadas[0].corpo).toEqual({
      uid: 'MQ',
      token: 'abc-123',
      nova_senha: 'NovaSenha#Sabia9',
      confirmar_senha: 'NovaSenha#Sabia9',
    })
  })

  it('oferece um novo link quando o atual expirou', async () => {
    const usuario = userEvent.setup()
    simularApi({
      'POST /auth/redefinir-senha/': [
        400,
        { non_field_errors: ['Este link de redefinição é inválido ou expirou. Peça um novo.'] },
      ],
    })
    renderizarApp('/redefinir-senha/MQ/velho')

    await usuario.type(screen.getByLabelText(/^Nova senha/), 'NovaSenha#Sabia9')
    await usuario.type(screen.getByLabelText(/Confirmar nova senha/), 'NovaSenha#Sabia9')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    const form = formulario()
    await waitFor(() => expect(within(form).getByRole('link', { name: 'Pedir um novo link →' })).toBeInTheDocument())
  })
})

describe('Sessão', () => {
  it('renova o token expirado e repete a chamada sem a pessoa perceber', async () => {
    sessionStorage.setItem('sabia.tokens', JSON.stringify({ access: 'vencido', refresh: 'r1', manterConectado: false }))
    let tentativas = 0
    simularApi({
      'GET /auth/eu/': () => (++tentativas === 1 ? [401, { detail: 'Token expirado' }] : [200, ESTUDANTE]),
      'POST /auth/renovar/': [200, { access: 'renovado', refresh: 'r2' }],
    })
    renderizarApp('/historico')

    expect(await screen.findByRole('heading', { name: 'Meu histórico' })).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('sabia.tokens'))).toMatchObject({ access: 'renovado', refresh: 'r2' })
  })

  it('com a renovação recusada, encerra a sessão e pede login', async () => {
    sessionStorage.setItem('sabia.tokens', JSON.stringify({ access: 'vencido', refresh: 'r1', manterConectado: false }))
    simularApi({
      'GET /auth/eu/': [401, { detail: 'Token expirado' }],
      'POST /auth/renovar/': [401, { detail: 'Token inválido' }],
    })
    renderizarApp('/historico')

    expect((await screen.findAllByRole('heading', { name: 'Entrar na conta' })).length).toBeGreaterThan(0)
    expect(sessionStorage.getItem('sabia.tokens')).toBeNull()
  })
})

describe('Força da senha', () => {
  it.each([
    ['', ''],
    ['abc', 'Fraca'],
    ['12345678', 'Fraca'],
    ['abcdefgh', 'Média'],
    ['Abcdefg1', 'Boa'],
    ['Sabia#Forte2026', 'Forte'],
  ])('"%s" é %s', (senha, esperado) => {
    expect(avaliarSenha(senha).rotulo).toBe(esperado)
  })
})

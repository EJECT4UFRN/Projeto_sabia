import { useState } from 'react'
import { Link } from 'react-router-dom'
import Alerta from '../../componentes/formulario/Alerta'
import BotaoEnviar from '../../componentes/formulario/BotaoEnviar'
import CampoTexto from '../../componentes/formulario/CampoTexto'
import { IconeUsuario } from '../../componentes/icones/Icones'
import { pedirRedefinicaoDeSenha } from '../../servicos/autenticacao'
import estilos from './CartaoAutenticacao.module.css'

// Tela inferida: o mockup tem o link "Esqueci minha senha", mas não a tela.
export default function PaginaEsqueciSenha() {
  const [login, setLogin] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmacao, setConfirmacao] = useState('')

  async function aoEnviar(evento) {
    evento.preventDefault()
    if (!login.trim()) {
      setErro('Informe seu nome de usuário ou e-mail.')
      return
    }
    setEnviando(true)
    setErro('')
    try {
      const resposta = await pedirRedefinicaoDeSenha(login.trim())
      setConfirmacao(resposta.detalhe)
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={estilos.pagina}>
      <section className={`${estilos.cartao} ${estilos.estreito}`} aria-labelledby="titulo-esqueci">
        <header className={estilos.cabecalho}>
          <p className={estilos.sobretitulo}>Recuperar acesso</p>
          <h1 id="titulo-esqueci" className={estilos.titulo}>
            Esqueci minha senha
          </h1>
          <p className={estilos.texto}>
            Informe seu usuário ou e-mail. Se a conta tiver um e-mail cadastrado, enviaremos um link para você criar
            uma senha nova.
          </p>
        </header>

        {confirmacao ? (
          <Alerta tipo="sucesso">
            {confirmacao} Confira também a caixa de spam. Se a sua conta não tem e-mail, peça ajuda ao seu professor.
          </Alerta>
        ) : (
          <form className={estilos.formulario} onSubmit={aoEnviar} noValidate>
            <Alerta>{erro}</Alerta>
            <CampoTexto
              variante="arredondado"
              rotulo="Usuário ou e-mail"
              icone={<IconeUsuario />}
              autoComplete="username"
              autoCapitalize="none"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
            <BotaoEnviar carregando={enviando} textoCarregando="Enviando…">
              Enviar link
            </BotaoEnviar>
          </form>
        )}

        <p className={estilos.convite}>
          Lembrou a senha?<Link to="/entrar">Entrar →</Link>
        </p>
      </section>
    </div>
  )
}

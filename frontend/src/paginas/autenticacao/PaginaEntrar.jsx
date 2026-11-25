import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import triBranco from '../../assets/decoracao/triangulo-branco.svg'
import triLaranja from '../../assets/decoracao/triangulo-laranja.svg'
import raioAmarelo from '../../assets/decoracao/raio-amarelo-contorno.svg'
import raioAzul from '../../assets/decoracao/raio-azul.svg'
import raioAzul2 from '../../assets/decoracao/raio-azul-2.svg'
import raioLaranja from '../../assets/decoracao/raio-laranja.svg'
import Alerta from '../../componentes/formulario/Alerta'
import BotaoEnviar from '../../componentes/formulario/BotaoEnviar'
import CaixaSelecao from '../../componentes/formulario/CaixaSelecao'
import CampoSenha from '../../componentes/formulario/CampoSenha'
import CampoTexto from '../../componentes/formulario/CampoTexto'
import { IconeCadeado, IconeEntrar, IconeUsuario } from '../../componentes/icones/Icones'
import Logo from '../../componentes/marca/Logo'
import { paginaInicialDoPerfil, useSessao } from '../../sessao/contexto'
import estilos from './PaginaEntrar.module.css'
import { TEXTOS } from './textos'

export default function PaginaEntrar({ perfil = 'estudante' }) {
  const textos = TEXTOS[perfil]
  const { usuario, entrar } = useSessao()
  const navegar = useNavigate()
  const local = useLocation()

  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [manterConectado, setManterConectado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // Já logado (ou acabou de entrar): segue para a página que a pessoa queria abrir ou para a inicial do perfil.
  if (usuario) return <Navigate to={local.state?.voltarPara ?? paginaInicialDoPerfil(usuario)} replace />

  async function aoEnviar(evento) {
    evento.preventDefault()
    if (!login.trim() || !senha) {
      setErro('Preencha usuário (ou e-mail) e senha.')
      return
    }
    setEnviando(true)
    setErro('')
    try {
      await entrar(login.trim(), senha, manterConectado)
    } catch (falha) {
      setErro(falha.message)
      setEnviando(false)
    }
  }

  function voltar() {
    if (window.history.length > 1) navegar(-1)
    else navegar('/entrar-pin')
  }

  return (
    <div className={estilos.pagina}>
      <section className={estilos.painel} aria-hidden="true">
        <img src={triBranco} alt="" className={`${estilos.forma} ${estilos.triBranco}`} />
        <img src={triLaranja} alt="" className={`${estilos.forma} ${estilos.triLaranja}`} />
        <img src={raioAzul2} alt="" className={`${estilos.forma} ${estilos.raioAzulAlto}`} />
        <img src={raioAmarelo} alt="" className={`${estilos.forma} ${estilos.raioAmarelo}`} />
        <img src={raioAzul} alt="" className={`${estilos.forma} ${estilos.raioAzulBaixo}`} />
        <img src={raioLaranja} alt="" className={`${estilos.forma} ${estilos.raioLaranja}`} />
        <div className={estilos.painelTextos}>
          <p className={estilos.painelTitulo}>{textos.painelTitulo}</p>
          <p className={estilos.painelTexto}>{textos.painelTexto}</p>
        </div>
      </section>

      <section className={estilos.ladoFormulario}>
        <div className={estilos.logoGrande}>
          <Logo largura={166} corTexto="laranja" tamanhoNome={60} />
        </div>

        <div className={estilos.cartao}>
          <header className={estilos.cabecalhoMobile}>
            <p className={estilos.sobretitulo}>{textos.sobretitulo}</p>
            <h1 className={estilos.titulo}>{textos.tituloEntrar}</h1>
            <p className={estilos.subtitulo}>{textos.subtituloEntrar}</p>
          </header>
          <h1 className={`visualmente-oculto ${estilos.soDesktop}`}>{textos.tituloEntrar}</h1>

          <form className={estilos.formulario} onSubmit={aoEnviar} noValidate>
            <Alerta>{erro}</Alerta>

            <CampoTexto
              rotulo="Usuário ou e-mail"
              icone={<IconeUsuario />}
              placeholder="Digite seu usuário ou e-mail"
              autoComplete="username"
              autoCapitalize="none"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              centralizarNoDesktop
            />

            <div className={estilos.blocoSenha}>
              <CampoSenha
                rotulo="Senha"
                icone={<IconeCadeado />}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                centralizarNoDesktop
              />
              <div className={estilos.linksSenha}>
                <Link to={textos.rotaCriarConta} className={`${estilos.linkCriarDesktop} ${estilos.soDesktop}`}>
                  Criar conta
                </Link>
                <Link to="/esqueci-senha" className={estilos.linkEsqueci}>
                  Esqueci minha senha
                </Link>
              </div>
            </div>

            <CaixaSelecao
              rotulo="Manter minha conta conectada"
              checked={manterConectado}
              onChange={(e) => setManterConectado(e.target.checked)}
            />

            <BotaoEnviar
              icone={<IconeEntrar />}
              carregando={enviando}
              textoCarregando="Entrando…"
              className={estilos.botaoEntrar}
            >
              Entrar
            </BotaoEnviar>
          </form>

          <div className={`${estilos.rodapeMobile} ${estilos.soMobile}`}>
            <div className={estilos.divisor}>
              <span>ou</span>
            </div>
            <p className={estilos.convite}>
              Ainda não tem uma conta? <Link to={textos.rotaCriarConta}>Criar conta</Link>
            </p>
          </div>

          <div className={`${estilos.rodapeDesktop} ${estilos.soDesktop}`}>
            {perfil === 'estudante' ? (
              <Link to="/entrar-pin" className={estilos.linkSecundario}>
                Entrar com PIN
              </Link>
            ) : (
              <Link to="/entrar" className={estilos.linkSecundario}>
                Sou estudante
              </Link>
            )}
            <button type="button" className={estilos.voltar} onClick={voltar}>
              Voltar
            </button>
          </div>
        </div>

        <p className={estilos.trocaDeArea}>
          {textos.trocaDeArea.pergunta} <Link to={textos.trocaDeArea.destino}>{textos.trocaDeArea.rotulo} →</Link>
        </p>
      </section>
    </div>
  )
}

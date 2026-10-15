import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Alerta from '../../componentes/formulario/Alerta'
import BotaoEnviar from '../../componentes/formulario/BotaoEnviar'
import CampoSenha from '../../componentes/formulario/CampoSenha'
import CampoTexto from '../../componentes/formulario/CampoTexto'
import MedidorForcaSenha from '../../componentes/formulario/MedidorForcaSenha'
import { IconeAdicionarUsuario } from '../../componentes/icones/Icones'
import { paginaInicialDoPerfil, useSessao } from '../../sessao/contexto'
import estilos from './CartaoAutenticacao.module.css'
import { TEXTOS } from './textos'

const VAZIO = { username: '', email: '', senha: '', confirmar_senha: '' }

export default function PaginaCriarConta({ perfil = 'estudante' }) {
  const textos = TEXTOS[perfil]
  const { usuario, cadastrar } = useSessao()

  const [dados, setDados] = useState(VAZIO)
  const [errosCampos, setErrosCampos] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [acabouDeCadastrar, setAcabouDeCadastrar] = useState(false)

  if (usuario) {
    const destino = acabouDeCadastrar ? textos.destinoAposCadastro : paginaInicialDoPerfil(usuario)
    return <Navigate to={destino} replace />
  }

  const senhasDiferentes = dados.confirmar_senha !== '' && dados.confirmar_senha !== dados.senha
  const senhasIguais = dados.confirmar_senha !== '' && dados.confirmar_senha === dados.senha

  function atualizar(campo) {
    return (evento) => {
      setDados((atual) => ({ ...atual, [campo]: evento.target.value }))
      setErrosCampos((atual) => ({ ...atual, [campo]: undefined }))
    }
  }

  function validarNoNavegador() {
    const erros = {}
    if (!dados.username.trim()) erros.username = 'Escolha um nome de usuário.'
    if (!dados.senha) erros.senha = 'Crie uma senha.'
    if (!dados.confirmar_senha) erros.confirmar_senha = 'Repita a senha.'
    else if (senhasDiferentes) erros.confirmar_senha = 'As senhas não coincidem.'
    return erros
  }

  async function aoEnviar(evento) {
    evento.preventDefault()
    const erros = validarNoNavegador()
    setErrosCampos(erros)
    if (Object.keys(erros).length) {
      setErroGeral('')
      return
    }
    setEnviando(true)
    setErroGeral('')
    // Marcado antes da chamada: assim que o usuário existir, o redirecionamento acima já usa o destino certo.
    setAcabouDeCadastrar(true)
    try {
      await cadastrar({ ...dados, username: dados.username.trim(), email: dados.email.trim(), perfil })
    } catch (falha) {
      setAcabouDeCadastrar(false)
      setErrosCampos({
        username: falha.doCampo?.('username'),
        email: falha.doCampo?.('email'),
        senha: falha.doCampo?.('senha'),
        confirmar_senha: falha.doCampo?.('confirmar_senha'),
      })
      setErroGeral(falha.message)
      setEnviando(false)
    }
  }

  return (
    <div className={estilos.pagina}>
      <section className={estilos.cartao} aria-labelledby="titulo-criar-conta">
        <header className={estilos.cabecalho}>
          <p className={estilos.sobretitulo}>{textos.sobretituloCadastro}</p>
          <h1 id="titulo-criar-conta" className={estilos.titulo}>
            Criar minha conta
          </h1>
        </header>

        <form className={estilos.formulario} onSubmit={aoEnviar} noValidate>
          <Alerta>{erroGeral}</Alerta>

          <CampoTexto
            variante="arredondado"
            rotulo="Nome de usuário"
            obrigatorio
            autoComplete="username"
            value={dados.username}
            onChange={atualizar('username')}
            erro={errosCampos.username}
            ajuda="É com ele que você entra. Pode ter espaços, letras, números e . _ - @"
          />

          <CampoTexto
            variante="arredondado"
            rotulo="E-mail"
            type="email"
            autoComplete="email"
            value={dados.email}
            onChange={atualizar('email')}
            erro={errosCampos.email}
            ajuda="Opcional. É por ele que você recupera a senha se esquecer."
          />

          <div>
            <CampoSenha
              variante="arredondado"
              rotulo="Senha"
              obrigatorio
              comBotaoMostrar={false}
              autoComplete="new-password"
              value={dados.senha}
              onChange={atualizar('senha')}
              erro={errosCampos.senha}
            />
            {!errosCampos.senha && <MedidorForcaSenha senha={dados.senha} />}
          </div>

          <CampoSenha
            variante="arredondado"
            rotulo="Confirmar senha"
            obrigatorio
            comBotaoMostrar={false}
            autoComplete="new-password"
            value={dados.confirmar_senha}
            onChange={atualizar('confirmar_senha')}
            erro={errosCampos.confirmar_senha ?? (senhasDiferentes ? 'As senhas não coincidem.' : undefined)}
            ajuda={senhasIguais ? <span className={estilos.coincidem}>Senhas coincidem ✓</span> : undefined}
          />

          <BotaoEnviar icone={<IconeAdicionarUsuario />} carregando={enviando} textoCarregando="Criando conta…">
            {textos.botaoCadastro}
          </BotaoEnviar>
        </form>

        <p className={estilos.convite}>
          Já tem conta?<Link to={textos.rotaEntrar}>Entrar →</Link>
        </p>
      </section>

      <p className={estilos.trocaDeArea}>
        {textos.trocaDeArea.pergunta} <Link to={textos.trocaDeArea.destino}>{textos.trocaDeArea.rotulo} →</Link>
      </p>
    </div>
  )
}

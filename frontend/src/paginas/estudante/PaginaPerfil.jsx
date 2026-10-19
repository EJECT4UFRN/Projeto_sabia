import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alerta from '../../componentes/formulario/Alerta'
import CampoSenha from '../../componentes/formulario/CampoSenha'
import { IconeDisquete, IconeEditar, IconeSair } from '../../componentes/icones/Icones'
import Avatar from '../../componentes/usuario/Avatar'
import { CORES_AVATAR, NOMES_CORES } from '../../componentes/usuario/coresAvatar'
import { alterarSenha, atualizarPerfil } from '../../servicos/autenticacao'
import { useSessao } from '../../sessao/contexto'
import CartaoMinhasTurmas from './CartaoMinhasTurmas'
import estilos from './PaginaPerfil.module.css'

const LIMITE_SOBRE_MIM = 200
const membroDesde = (iso) =>
  new Date(iso)
    .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    .replace('.', '')
    .replace(' de ', '/')

function formularioInicial(usuario) {
  return {
    nome_exibicao: usuario.nome_exibicao ?? '',
    email: usuario.email ?? '',
    cor_avatar: usuario.cor_avatar,
    sobre_mim: usuario.sobre_mim ?? '',
  }
}

function errosDaApi(falha, campos) {
  const erros = {}
  campos.forEach((campo) => {
    const mensagem = falha.doCampo?.(campo)
    if (mensagem) erros[campo] = mensagem
  })
  return erros
}

/** Perfil do estudante (e do professor, dentro do painel). */
export default function PaginaPerfil({ noPainel = false }) {
  const { usuario, atualizarUsuario, sair } = useSessao()
  const navegar = useNavigate()
  const [form, setForm] = useState(() => formularioInicial(usuario))
  const [editandoEmail, setEditandoEmail] = useState(false)
  const [senhaParaEmail, setSenhaParaEmail] = useState('')
  const [erros, setErros] = useState({})
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' })
  const [salvando, setSalvando] = useState(false)

  const [senhas, setSenhas] = useState({ senha_atual: '', senha: '', confirmar_senha: '' })
  const [errosSenha, setErrosSenha] = useState({})
  const [mensagemSenha, setMensagemSenha] = useState({ tipo: '', texto: '' })
  const [trocandoSenha, setTrocandoSenha] = useState(false)

  // Prévia: o avatar e o nome mudam enquanto a pessoa edita.
  const nomePrevia = form.nome_exibicao.trim() || usuario.username
  const iniciaisPrevia = form.nome_exibicao.trim() ? iniciaisDe(nomePrevia) : usuario.iniciais

  function mudar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErros((e) => ({ ...e, [campo]: undefined }))
    setMensagem({ tipo: '', texto: '' })
  }

  async function salvar(evento) {
    evento.preventDefault()
    const encontrados = {}
    const emailMudou = form.email.trim().toLowerCase() !== (usuario.email ?? '').toLowerCase()
    if (form.sobre_mim.length > LIMITE_SOBRE_MIM) encontrados.sobre_mim = 'Use no máximo 200 caracteres.'
    if (emailMudou && !senhaParaEmail) encontrados.senha_atual = 'Digite sua senha atual para trocar o e-mail.'
    setErros(encontrados)
    if (Object.keys(encontrados).length) return

    setSalvando(true)
    setMensagem({ tipo: '', texto: '' })
    try {
      const corpo = { ...form, email: form.email.trim() }
      if (emailMudou) corpo.senha_atual = senhaParaEmail
      else delete corpo.email
      const atualizado = await atualizarPerfil(corpo)
      atualizarUsuario(atualizado)
      setForm(formularioInicial(atualizado))
      setEditandoEmail(false)
      setSenhaParaEmail('')
      setMensagem({ tipo: 'sucesso', texto: 'Perfil salvo.' })
    } catch (falha) {
      const doServidor = errosDaApi(falha, ['nome_exibicao', 'email', 'cor_avatar', 'sobre_mim', 'senha_atual'])
      setErros(doServidor)
      setMensagem({ tipo: 'erro', texto: Object.keys(doServidor).length ? 'Confira os campos destacados.' : falha.message })
    } finally {
      setSalvando(false)
    }
  }

  async function trocarSenha(evento) {
    evento.preventDefault()
    const encontrados = {}
    if (!senhas.senha_atual) encontrados.senha_atual = 'Digite sua senha atual.'
    if (!senhas.senha) encontrados.senha = 'Digite a nova senha.'
    if (senhas.senha !== senhas.confirmar_senha) encontrados.confirmar_senha = 'As senhas não coincidem.'
    setErrosSenha(encontrados)
    setMensagemSenha({ tipo: '', texto: '' })
    if (Object.keys(encontrados).length) return

    setTrocandoSenha(true)
    try {
      await alterarSenha(senhas)
      setSenhas({ senha_atual: '', senha: '', confirmar_senha: '' })
      setMensagemSenha({ tipo: 'sucesso', texto: 'Senha alterada.' })
    } catch (falha) {
      const doServidor = errosDaApi(falha, ['senha_atual', 'senha', 'confirmar_senha'])
      setErrosSenha(doServidor)
      setMensagemSenha({ tipo: 'erro', texto: Object.keys(doServidor).length ? 'Confira os campos destacados.' : falha.message })
    } finally {
      setTrocandoSenha(false)
    }
  }

  async function sairDaConta() {
    await sair()
    navegar(usuario.perfil === 'professor' ? '/professor/entrar' : '/entrar')
  }

  return (
    <section className={`${estilos.pagina} ${noPainel ? estilos.noPainel : ''}`}>
      <h1 className="visualmente-oculto">Meu perfil</h1>

      <form onSubmit={salvar} noValidate className={estilos.formulario}>
        <div className={estilos.cartao}>
          <h2 className={estilos.rotuloSecao}>Aparência</h2>
          <div className={estilos.identidade}>
            <Avatar iniciais={iniciaisPrevia} cor={form.cor_avatar} tamanho={80} quadrado />
            <div>
              <p className={estilos.nome}>{nomePrevia}</p>
              <p className={estilos.desde}>Membro desde {membroDesde(usuario.date_joined)}</p>
            </div>
          </div>
          <fieldset className={estilos.grupoCores}>
            <legend className={estilos.rotuloSecao}>Cor do avatar</legend>
            <div className={estilos.cores}>
              {Object.entries(CORES_AVATAR).map(([chave, cor]) => (
                <label key={chave} className={estilos.cor} style={{ background: cor }} title={NOMES_CORES[chave]}>
                  <input
                    type="radio"
                    name="cor_avatar"
                    value={chave}
                    checked={form.cor_avatar === chave}
                    onChange={() => mudar('cor_avatar', chave)}
                    aria-label={NOMES_CORES[chave]}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className={estilos.cartao}>
          <h2 className={estilos.rotuloSecao}>Informações</h2>

          <div className={estilos.campo}>
            <label htmlFor="perfil-nome" className={estilos.rotulo}>
              Nome de exibição:
            </label>
            <input
              id="perfil-nome"
              className={estilos.entrada}
              maxLength={60}
              placeholder={usuario.username}
              value={form.nome_exibicao}
              aria-invalid={Boolean(erros.nome_exibicao)}
              aria-describedby="perfil-nome-ajuda"
              onChange={(e) => mudar('nome_exibicao', e.target.value)}
            />
            <span id="perfil-nome-ajuda" className={estilos.ajuda}>
              Deixe em branco para usar o nome de usuário ({usuario.username}).
            </span>
            {erros.nome_exibicao && <span className={estilos.erro}>{erros.nome_exibicao}</span>}
          </div>

          <div className={estilos.campo}>
            <label htmlFor="perfil-email" className={estilos.rotulo}>
              Email:
            </label>
            <div className={estilos.comBotao}>
              <input
                id="perfil-email"
                type="email"
                className={estilos.entrada}
                value={form.email}
                readOnly={!editandoEmail}
                placeholder="Sem e-mail cadastrado"
                aria-invalid={Boolean(erros.email)}
                onChange={(e) => mudar('email', e.target.value)}
              />
              {!editandoEmail && (
                <button
                  type="button"
                  className={estilos.botaoEditar}
                  aria-label="Alterar e-mail"
                  onClick={() => setEditandoEmail(true)}
                >
                  <IconeEditar />
                </button>
              )}
            </div>
            {erros.email && <span className={estilos.erro}>{erros.email}</span>}
            {editandoEmail && (
              <div className={estilos.campoSenhaEmail}>
                <CampoSenha
                  variante="arredondado"
                  rotulo="Senha atual (para trocar o e-mail)"
                  value={senhaParaEmail}
                  autoComplete="current-password"
                  erro={erros.senha_atual}
                  onChange={(e) => {
                    setSenhaParaEmail(e.target.value)
                    setErros((er) => ({ ...er, senha_atual: undefined }))
                  }}
                />
              </div>
            )}
          </div>

          <div className={estilos.campo}>
            <label htmlFor="perfil-sobre" className={estilos.rotulo}>
              Sobre mim
            </label>
            <textarea
              id="perfil-sobre"
              className={`${estilos.entrada} ${estilos.sobre}`}
              maxLength={LIMITE_SOBRE_MIM}
              rows={3}
              placeholder="Conte um pouco sobre você"
              value={form.sobre_mim}
              aria-invalid={Boolean(erros.sobre_mim)}
              onChange={(e) => mudar('sobre_mim', e.target.value)}
            />
            <span className={estilos.contador}>
              {form.sobre_mim.length}/{LIMITE_SOBRE_MIM}
            </span>
            {erros.sobre_mim && <span className={estilos.erro}>{erros.sobre_mim}</span>}
          </div>

          <Alerta tipo={mensagem.tipo || 'erro'}>{mensagem.texto}</Alerta>
          <button type="submit" className={estilos.botaoSalvar} disabled={salvando}>
            <IconeDisquete /> {salvando ? 'Salvando…' : 'Salvar perfil'}
          </button>
        </div>
      </form>

      {!noPainel && usuario.perfil !== 'professor' && <CartaoMinhasTurmas />}

      <form onSubmit={trocarSenha} noValidate className={estilos.cartao}>
        <h2 className={estilos.rotuloSecao}>Alterar senha</h2>
        <div className={estilos.gradeSenhas}>
          <CampoSenha
            variante="arredondado"
            rotulo="Senha atual"
            autoComplete="current-password"
            value={senhas.senha_atual}
            erro={errosSenha.senha_atual}
            onChange={(e) => setSenhas((s) => ({ ...s, senha_atual: e.target.value }))}
          />
          <CampoSenha
            variante="arredondado"
            rotulo="Nova senha"
            autoComplete="new-password"
            value={senhas.senha}
            erro={errosSenha.senha}
            onChange={(e) => setSenhas((s) => ({ ...s, senha: e.target.value }))}
          />
          <CampoSenha
            variante="arredondado"
            rotulo="Confirmar nova senha"
            autoComplete="new-password"
            value={senhas.confirmar_senha}
            erro={errosSenha.confirmar_senha}
            onChange={(e) => setSenhas((s) => ({ ...s, confirmar_senha: e.target.value }))}
          />
        </div>
        <Alerta tipo={mensagemSenha.tipo || 'erro'}>{mensagemSenha.texto}</Alerta>
        <button type="submit" className={estilos.botaoSecundario} disabled={trocandoSenha}>
          {trocandoSenha ? 'Alterando…' : 'Alterar senha'}
        </button>
      </form>

      <footer className={estilos.rodape}>
        <button type="button" onClick={sairDaConta}>
          <IconeSair /> Sair da conta
        </button>
      </footer>
    </section>
  )
}

function iniciaisDe(nome) {
  const partes = nome.split(/\s+/)
  if (partes.length >= 2) return (partes[0][0] + partes.at(-1)[0]).toUpperCase()
  const maiusculas = [...nome].filter((letra) => letra !== letra.toLowerCase())
  if (maiusculas.length >= 2) return maiusculas[0] + maiusculas.at(-1)
  return nome.slice(0, 2).toUpperCase()
}

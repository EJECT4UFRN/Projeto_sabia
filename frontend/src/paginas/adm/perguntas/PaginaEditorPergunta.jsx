import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Carregando from '../../../componentes/estados/Carregando'
import Alerta from '../../../componentes/formulario/Alerta'
import {
  IconeCheckCirculo,
  IconeDisquete,
  IconeImagem,
  IconeMaisCirculo,
  IconeMaisPequeno,
  IconeMaoClique,
  IconeVisto,
} from '../../../componentes/icones/Icones'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import CabecalhoPagina from '../../../componentes/painel/CabecalhoPagina'
import Modal from '../../../componentes/painel/Modal'
import Selecao from '../../../componentes/painel/Selecao'
import { DIFICULDADES } from '../../../componentes/painel/dificuldades'
import {
  buscarPergunta,
  criarCategoria,
  listarCategorias,
  salvarPergunta,
} from '../../../servicos/perguntas'
import estilos from './PaginaEditorPergunta.module.css'
import { LETRAS, LIMITES, validarPergunta } from './validacaoPergunta'

const VAZIA = {
  texto: '',
  alternativa_a: '',
  alternativa_b: '',
  alternativa_c: '',
  alternativa_d: '',
  resposta_correta: '',
  categoria: '',
  dificuldade: 'medio',
  tempo_limite: String(LIMITES.tempo.padrao),
  pontuacao_maxima: String(LIMITES.pontuacao.padrao),
  ativa: true,
}

const CAMPOS_ENVIADOS = Object.keys(VAZIA)
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Texto de uma alternativa: uma linha que cresce quando o texto não cabe (no celular, as
 * alternativas longas quebram em duas linhas, como no mockup). Enter não cria quebra de linha.
 */
function TextoAlternativa({ value, ...props }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const campo = ref.current
    if (!campo) return
    campo.style.height = 'auto'
    campo.style.height = `${campo.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      maxLength={150}
      value={value}
      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
      {...props}
    />
  )
}

function paraFormulario(pergunta) {
  const dados = {}
  CAMPOS_ENVIADOS.forEach((campo) => {
    const valor = pergunta[campo]
    dados[campo] = typeof valor === 'boolean' ? valor : valor === null || valor === undefined ? '' : String(valor)
  })
  return dados
}

function paraEnvio(dados) {
  return {
    ...dados,
    texto: dados.texto.trim(),
    categoria: dados.categoria ? Number(dados.categoria) : null,
    tempo_limite: Number(dados.tempo_limite),
    pontuacao_maxima: Number(dados.pontuacao_maxima),
  }
}

export default function PaginaEditorPergunta() {
  const { id } = useParams()
  const editando = Boolean(id)
  const navegar = useNavigate()
  const idBase = useId()
  const arquivoRef = useRef(null)

  const [dados, setDados] = useState(VAZIA)
  const [categorias, setCategorias] = useState([])
  const [carregando, setCarregando] = useState(editando)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const [erroCarregar, setErroCarregar] = useState('')
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [imagemAtual, setImagemAtual] = useState(null)
  const [imagemNova, setImagemNova] = useState(null)
  const [removerImagem, setRemoverImagem] = useState(false)
  const [previa, setPrevia] = useState(null)

  const [criandoCategoria, setCriandoCategoria] = useState(false)
  const [nomeCategoria, setNomeCategoria] = useState('')
  const [erroCategoria, setErroCategoria] = useState('')
  const [salvandoCategoria, setSalvandoCategoria] = useState(false)

  useEffect(() => {
    listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]))
  }, [])

  useEffect(() => {
    if (!editando) return undefined
    let ativo = true
    buscarPergunta(id)
      .then((pergunta) => {
        if (!ativo) return
        setDados(paraFormulario(pergunta))
        setImagemAtual(pergunta.imagem)
      })
      .catch((falha) => {
        if (!ativo) return
        if (falha.status === 404) setNaoEncontrada(true)
        else setErroCarregar(falha.message)
      })
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [editando, id])

  // Libera da memória a prévia local da imagem quando ela é trocada ou a tela fecha.
  const previaRef = useRef(null)
  useEffect(() => () => previaRef.current && URL.revokeObjectURL(previaRef.current), [])

  function trocarPrevia(arquivo) {
    if (previaRef.current) URL.revokeObjectURL(previaRef.current)
    previaRef.current = arquivo ? URL.createObjectURL(arquivo) : null
    setPrevia(previaRef.current)
  }

  function atualizar(campo, valor) {
    setDados((atual) => ({ ...atual, [campo]: valor }))
    setErros((atual) => ({ ...atual, [campo]: undefined }))
  }

  function marcarCorreta(letra) {
    atualizar('resposta_correta', letra.toUpperCase())
  }

  function escolherImagem(evento) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    if (!TIPOS_IMAGEM.includes(arquivo.type)) {
      setErros((atual) => ({ ...atual, imagem: 'Use uma imagem JPG, PNG, WEBP ou GIF.' }))
      return
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      setErros((atual) => ({ ...atual, imagem: 'A imagem pode ter no máximo 5 MB.' }))
      return
    }
    setErros((atual) => ({ ...atual, imagem: undefined }))
    setImagemNova(arquivo)
    trocarPrevia(arquivo)
    setRemoverImagem(false)
  }

  function tirarImagem() {
    setImagemNova(null)
    trocarPrevia(null)
    if (imagemAtual) setRemoverImagem(true)
  }

  async function aoEnviar(evento) {
    evento.preventDefault()
    const encontrados = validarPergunta(dados)
    setErros(encontrados)
    if (Object.keys(encontrados).length) {
      setErroGeral('Confira os campos destacados.')
      return
    }
    setSalvando(true)
    setErroGeral('')
    try {
      await salvarPergunta(id, paraEnvio(dados), { imagem: imagemNova, removerImagem })
      navegar('/adm/perguntas', { state: { aviso: editando ? 'Alterações salvas.' : 'Pergunta criada.' } })
    } catch (falha) {
      const doServidor = {}
      ;[...CAMPOS_ENVIADOS, 'imagem'].forEach((campo) => {
        const mensagem = falha.doCampo?.(campo)
        if (mensagem) doServidor[campo] = mensagem
      })
      setErros(doServidor)
      setErroGeral(falha.message)
      setSalvando(false)
    }
  }

  async function salvarCategoria(evento) {
    evento.preventDefault()
    if (!nomeCategoria.trim()) {
      setErroCategoria('Dê um nome para a categoria.')
      return
    }
    setSalvandoCategoria(true)
    setErroCategoria('')
    try {
      const nova = await criarCategoria(nomeCategoria.trim())
      setCategorias((atuais) =>
        [...atuais, nova].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
      )
      atualizar('categoria', String(nova.id))
      setCriandoCategoria(false)
      setNomeCategoria('')
    } catch (falha) {
      setErroCategoria(falha.doCampo?.('nome') ?? falha.message)
    } finally {
      setSalvandoCategoria(false)
    }
  }

  const titulo = editando ? 'Editar pergunta' : 'Nova pergunta'
  const migalhas = [
    { rotulo: 'Dashboard', para: '/adm' },
    { rotulo: 'Banco de Perguntas', para: '/adm/perguntas' },
    { rotulo: editando ? 'Editar' : 'Nova' },
  ]

  if (carregando) {
    return (
      <>
        <CabecalhoPagina migalhas={migalhas} titulo={titulo} />
        <Carregando texto="Carregando pergunta…" />
      </>
    )
  }

  if (naoEncontrada || erroCarregar) {
    return (
      <>
        <CabecalhoPagina migalhas={migalhas} titulo={titulo} />
        <div className={estilos.cartao}>
          <Alerta>{naoEncontrada ? 'Esta pergunta não existe ou foi excluída.' : erroCarregar}</Alerta>
          <Link to="/adm/perguntas" className={estilos.voltar}>
            ← Voltar ao banco de perguntas
          </Link>
        </div>
      </>
    )
  }

  const imagemExibida = previa ?? (removerImagem ? null : imagemAtual)

  return (
    <>
      <CabecalhoPagina migalhas={migalhas} titulo={titulo} />

      <form className={estilos.cartao} onSubmit={aoEnviar} noValidate>
        <Alerta>{erroGeral}</Alerta>

        <div className={estilos.campo}>
          <label htmlFor={`${idBase}-texto`} className={estilos.rotulo}>
            Texto da pergunta <span aria-hidden="true">*</span>
          </label>
          <textarea
            id={`${idBase}-texto`}
            className={`${estilos.areaTexto} ${erros.texto ? estilos.comErro : ''}`}
            maxLength={300}
            placeholder="Digite a pergunta"
            value={dados.texto}
            onChange={(e) => atualizar('texto', e.target.value)}
            aria-invalid={erros.texto ? true : undefined}
            aria-describedby={erros.texto ? `${idBase}-texto-erro` : undefined}
            required
          />
          {erros.texto && (
            <p id={`${idBase}-texto-erro`} className={estilos.erro}>
              {erros.texto}
            </p>
          )}
        </div>

        <fieldset className={estilos.grupo}>
          <legend className={estilos.rotulo}>
            Opções de resposta <span aria-hidden="true">*</span>
          </legend>
          <p className={estilos.ajuda}>Preencha as 4 opções e marque qual é a correta.</p>

          <div className={estilos.opcoes} role="radiogroup" aria-label="Resposta correta">
            {LETRAS.map((letra) => {
              const maiuscula = letra.toUpperCase()
              const campo = `alternativa_${letra}`
              const correta = dados.resposta_correta === maiuscula
              return (
                <div key={letra}>
                  <div
                    className={`${estilos.opcao} ${correta ? estilos.opcaoCorreta : ''} ${erros[campo] ? estilos.comErro : ''}`}
                    onClick={(e) => !['INPUT', 'TEXTAREA'].includes(e.target.tagName) && marcarCorreta(letra)}
                  >
                    <label className={`${estilos.letra} ${estilos[`letra-${letra}`]}`}>
                      <input
                        type="radio"
                        name={`${idBase}-correta`}
                        className="visualmente-oculto"
                        checked={correta}
                        onChange={() => marcarCorreta(letra)}
                        aria-label={`Marcar ${maiuscula} como correta`}
                      />
                      {maiuscula}
                    </label>
                    <TextoAlternativa
                      className={estilos.textoOpcao}
                      placeholder={`Resposta ${maiuscula}`}
                      aria-label={`Alternativa ${maiuscula}`}
                      value={dados[campo]}
                      onChange={(e) => atualizar(campo, e.target.value)}
                      aria-invalid={erros[campo] ? true : undefined}
                    />
                    <span
                      className={`${estilos.marcaCorreta} ${correta ? estilos.marcada : ''}`}
                      aria-hidden="true"
                      title={correta ? 'Resposta correta' : 'Marcar como correta'}
                    >
                      {correta ? <IconeCheckCirculo /> : <span className={estilos.circuloVazio} />}
                    </span>
                  </div>
                  {erros[campo] && <p className={estilos.erro}>{erros[campo]}</p>}
                </div>
              )
            })}
          </div>
          <p className={`${estilos.dica} ${erros.resposta_correta ? estilos.dicaErro : ''}`} aria-live="polite">
            <IconeMaoClique />
            {erros.resposta_correta ?? 'Clique na letra ou no círculo da opção para marcá-la como correta'}
          </p>
        </fieldset>

        <div className={estilos.linha}>
          <div className={estilos.campo}>
            <div className={estilos.rotuloComAcao}>
              <label htmlFor={`${idBase}-categoria`} className={estilos.rotulo}>
                Categoria
              </label>
              <button
                type="button"
                className={estilos.novaCategoria}
                onClick={() => {
                  setErroCategoria('')
                  setCriandoCategoria(true)
                }}
              >
                <IconeMaisPequeno />
                Nova categoria
              </button>
            </div>
            <Selecao
              id={`${idBase}-categoria`}
              value={dados.categoria}
              onChange={(e) => atualizar('categoria', e.target.value)}
              aria-invalid={erros.categoria ? true : undefined}
            >
              <option value="">Sem categoria</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </Selecao>
            {erros.categoria && <p className={estilos.erro}>{erros.categoria}</p>}
          </div>

          <div className={estilos.campo}>
            <label htmlFor={`${idBase}-dificuldade`} className={estilos.rotulo}>
              Dificuldade
            </label>
            <Selecao
              id={`${idBase}-dificuldade`}
              value={dados.dificuldade}
              onChange={(e) => atualizar('dificuldade', e.target.value)}
            >
              {DIFICULDADES.map(({ valor, rotulo }) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Selecao>
          </div>
        </div>

        <div className={estilos.linha}>
          <div className={estilos.campo}>
            <label htmlFor={`${idBase}-tempo`} className={estilos.rotulo}>
              Tempo limite (segundos)
            </label>
            <input
              id={`${idBase}-tempo`}
              type="number"
              inputMode="numeric"
              min={LIMITES.tempo.min}
              max={LIMITES.tempo.max}
              className={`${estilos.numero} ${erros.tempo_limite ? estilos.comErro : ''}`}
              value={dados.tempo_limite}
              onChange={(e) => atualizar('tempo_limite', e.target.value)}
              aria-invalid={erros.tempo_limite ? true : undefined}
            />
            {erros.tempo_limite && <p className={estilos.erro}>{erros.tempo_limite}</p>}
          </div>

          <div className={estilos.campo}>
            <label htmlFor={`${idBase}-pontuacao`} className={estilos.rotulo}>
              Pontuação máxima
            </label>
            <input
              id={`${idBase}-pontuacao`}
              type="number"
              inputMode="numeric"
              min={LIMITES.pontuacao.min}
              max={LIMITES.pontuacao.max}
              step={50}
              className={`${estilos.numero} ${erros.pontuacao_maxima ? estilos.comErro : ''}`}
              value={dados.pontuacao_maxima}
              onChange={(e) => atualizar('pontuacao_maxima', e.target.value)}
              aria-invalid={erros.pontuacao_maxima ? true : undefined}
            />
            {erros.pontuacao_maxima && <p className={estilos.erro}>{erros.pontuacao_maxima}</p>}
          </div>
        </div>

        <div className={estilos.campo}>
          <span className={estilos.rotulo}>
            Imagem <span className={estilos.opcional}>(opcional)</span>
          </span>
          {imagemExibida ? (
            <div className={estilos.previa}>
              <img src={imagemExibida} alt="Imagem da pergunta" />
              <div className={estilos.acoesImagem}>
                <BotaoPainel variante="contorno" onClick={() => arquivoRef.current?.click()}>
                  Trocar imagem
                </BotaoPainel>
                <BotaoPainel variante="contorno" onClick={tirarImagem}>
                  Remover
                </BotaoPainel>
              </div>
            </div>
          ) : (
            <button type="button" className={estilos.areaImagem} onClick={() => arquivoRef.current?.click()}>
              <IconeImagem />
              Selecionar imagem (JPG, PNG, WEBP ou GIF, até 5 MB)
            </button>
          )}
          <input
            ref={arquivoRef}
            type="file"
            accept={TIPOS_IMAGEM.join(',')}
            className="visualmente-oculto"
            tabIndex={-1}
            aria-label="Escolher imagem da pergunta"
            onChange={escolherImagem}
          />
          {erros.imagem && <p className={estilos.erro}>{erros.imagem}</p>}
        </div>

        <label className={estilos.ativa}>
          <input
            type="checkbox"
            className="visualmente-oculto"
            checked={dados.ativa}
            onChange={(e) => atualizar('ativa', e.target.checked)}
          />
          <span className={estilos.caixaAtiva} aria-hidden="true">
            {dados.ativa && <IconeVisto />}
          </span>
          Pergunta ativa
        </label>

        <div className={estilos.botoes}>
          <BotaoPainel variante="contorno" para="/adm/perguntas" className={estilos.cancelar}>
            Cancelar
          </BotaoPainel>
          <BotaoPainel
            type="submit"
            icone={editando ? <IconeDisquete /> : <IconeMaisCirculo />}
            disabled={salvando}
            className={estilos.salvar}
          >
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar pergunta'}
          </BotaoPainel>
        </div>
      </form>

      <Modal
        aberto={criandoCategoria}
        aoFechar={() => !salvandoCategoria && setCriandoCategoria(false)}
        sobretitulo="Banco de perguntas"
        titulo="Nova categoria"
        descricao="Agrupe suas perguntas por tema, como “Energia Solar”."
        largura={460}
      >
        <form className={estilos.formCategoria} onSubmit={salvarCategoria} noValidate>
          <label htmlFor={`${idBase}-nova-categoria`} className={estilos.rotulo}>
            Nome da categoria
          </label>
          <input
            id={`${idBase}-nova-categoria`}
            type="text"
            maxLength={60}
            className={`${estilos.numero} ${erroCategoria ? estilos.comErro : ''}`}
            value={nomeCategoria}
            onChange={(e) => setNomeCategoria(e.target.value)}
            aria-invalid={erroCategoria ? true : undefined}
          />
          {erroCategoria && <p className={estilos.erro}>{erroCategoria}</p>}
          <div className={estilos.botoesCategoria}>
            <BotaoPainel variante="contorno" onClick={() => setCriandoCategoria(false)}>
              Cancelar
            </BotaoPainel>
            <BotaoPainel type="submit" disabled={salvandoCategoria}>
              {salvandoCategoria ? 'Criando…' : 'Criar categoria'}
            </BotaoPainel>
          </div>
        </form>
      </Modal>
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Carregando from '../../../componentes/estados/Carregando'
import Alerta from '../../../componentes/formulario/Alerta'
import { IconeAlca, IconeLapis, IconeLixeira, IconePlay } from '../../../componentes/icones/Icones'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import CabecalhoPagina from '../../../componentes/painel/CabecalhoPagina'
import { DIFICULDADES } from '../../../componentes/painel/dificuldades'
import { listarPerguntas, salvarPergunta } from '../../../servicos/perguntas'
import SeletorDisciplina from '../../../componentes/painel/SeletorDisciplina'
import { listarDisciplinas } from '../../../servicos/escola'
import { buscarQuiz, editarPerguntaNoQuiz, salvarQuiz } from '../../../servicos/quizzes'
import { LIMITES } from '../perguntas/validacaoPergunta'
import ModalPerguntaQuiz from './ModalPerguntaQuiz'
import estilos from './PaginaEditorQuiz.module.css'

const ESPERA_BUSCA = 350
const ordenarPorNome = (lista) => [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
const FORM_VAZIO = {
  titulo: '',
  descricao: '',
  disciplina_id: '',
  turma: '',
  dificuldade: 'medio',
  tempo_padrao: String(LIMITES.tempo.padrao),
  pontuacao_padrao: String(LIMITES.pontuacao.padrao),
  embaralhar_respostas: false,
  embaralhar_perguntas: false,
  publicado: false,
}

function paraFormulario(quiz) {
  return {
    titulo: quiz.titulo,
    descricao: quiz.descricao,
    disciplina_id: quiz.disciplina_id ? String(quiz.disciplina_id) : '',
    turma: quiz.turma,
    dificuldade: quiz.dificuldade,
    tempo_padrao: String(quiz.tempo_padrao),
    pontuacao_padrao: String(quiz.pontuacao_padrao),
    embaralhar_respostas: quiz.embaralhar_respostas,
    embaralhar_perguntas: quiz.embaralhar_perguntas,
    publicado: quiz.status === 'publicado',
  }
}

function paraEnvio(form, perguntas) {
  const { publicado, ...resto } = form
  return {
    ...resto,
    disciplina_id: form.disciplina_id ? Number(form.disciplina_id) : null,
    tempo_padrao: Number(form.tempo_padrao),
    pontuacao_padrao: Number(form.pontuacao_padrao),
    status: publicado ? 'publicado' : 'rascunho',
    perguntas_ids: perguntas.map((p) => p.id),
  }
}

const retrato = (form, perguntas) => JSON.stringify(paraEnvio(form, perguntas))

function validar(form, perguntas) {
  const erros = {}
  if (!form.titulo.trim()) erros.titulo = 'Dê um título para o quiz.'
  const tempo = Number(form.tempo_padrao)
  if (!Number.isInteger(tempo) || tempo < LIMITES.tempo.min || tempo > LIMITES.tempo.max) {
    erros.tempo_padrao = `Use um tempo entre ${LIMITES.tempo.min} e ${LIMITES.tempo.max} segundos.`
  }
  const pontos = Number(form.pontuacao_padrao)
  if (!Number.isInteger(pontos) || pontos < LIMITES.pontuacao.min || pontos > LIMITES.pontuacao.max) {
    erros.pontuacao_padrao = `Use uma pontuação entre ${LIMITES.pontuacao.min} e ${LIMITES.pontuacao.max}.`
  }
  if (form.publicado && perguntas.length === 0) {
    erros.perguntas_ids = 'Adicione ao menos uma pergunta para publicar o quiz.'
  }
  return erros
}

/** Carrega o quiz (na edição) e entrega o editor já preenchido. */
export default function PaginaEditorQuiz() {
  const { id } = useParams()
  const [carga, setCarga] = useState({ id: null, quiz: null, erro: '' })
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    if (!id) return undefined
    let ativo = true
    buscarQuiz(id)
      .then((quiz) => ativo && setCarga({ id, quiz, erro: '' }))
      .catch((falha) => ativo && setCarga({ id, quiz: null, erro: falha.message }))
    return () => {
      ativo = false
    }
  }, [id, versao])

  if (!id) return <Editor key="novo" quiz={null} />
  if (carga.id !== id) return <Carregando texto="Carregando quiz…" />
  if (carga.erro) {
    return (
      <div className={estilos.estado}>
        <Alerta>{carga.erro}</Alerta>
        <BotaoPainel variante="contorno" onClick={() => setVersao((v) => v + 1)}>
          Tentar de novo
        </BotaoPainel>
      </div>
    )
  }
  return <Editor key={`${id}-${carga.quiz.atualizado_em}`} quiz={carga.quiz} />
}

function Editor({ quiz }) {
  const navegar = useNavigate()
  const local = useLocation()
  const [form, setForm] = useState(() => (quiz ? paraFormulario(quiz) : FORM_VAZIO))
  const [perguntas, setPerguntas] = useState(() => quiz?.perguntas ?? [])
  const [salvo, setSalvo] = useState(() => (quiz ? { retrato: retrato(paraFormulario(quiz), quiz.perguntas), quiz } : null))
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [aviso, setAviso] = useState(local.state?.aviso ?? '')
  const [salvando, setSalvando] = useState(false)
  const [disciplinas, setDisciplinas] = useState([])
  const [modal, setModal] = useState(null) // { pergunta } — pergunta null = nova
  const [arrastando, setArrastando] = useState(null)

  // Banco de perguntas (coluna da direita)
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const esperaBusca = useRef(null)
  const [banco, setBanco] = useState({ termo: null, itens: [], erro: '' })
  const [versaoBanco, setVersaoBanco] = useState(0)
  const carregandoBanco = banco.termo !== `${termo}#${versaoBanco}`

  const alterado = !salvo || salvo.retrato !== retrato(form, perguntas)
  const podeIniciar = Boolean(salvo && !alterado && salvo.quiz.status === 'publicado' && perguntas.length > 0)

  useEffect(() => {
    listarDisciplinas()
      .then(setDisciplinas)
      .catch(() => setDisciplinas([]))
  }, [])

  useEffect(() => {
    if (local.state?.aviso) navegar(local.pathname, { replace: true, state: null })
  }, [local, navegar])

  useEffect(() => {
    let ativo = true
    const chave = `${termo}#${versaoBanco}`
    listarPerguntas({ ativa: 'true', busca: termo, por_pagina: 50 })
      .then((dados) => ativo && setBanco({ termo: chave, itens: dados.results, erro: '' }))
      .catch((falha) => ativo && setBanco({ termo: chave, itens: [], erro: falha.message }))
    return () => {
      ativo = false
    }
  }, [termo, versaoBanco])

  useEffect(() => () => clearTimeout(esperaBusca.current), [])

  function mudar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErros((e) => ({ ...e, [campo]: undefined }))
    setAviso('')
  }

  function mudarPerguntas(atualizar) {
    setPerguntas(atualizar)
    setErros((e) => ({ ...e, perguntas_ids: undefined }))
    setAviso('')
  }

  function alternarDoBanco(pergunta) {
    mudarPerguntas((lista) =>
      lista.some((p) => p.id === pergunta.id) ? lista.filter((p) => p.id !== pergunta.id) : [...lista, pergunta],
    )
  }

  function mover(de, para) {
    if (para < 0 || para >= perguntas.length || de === para) return
    mudarPerguntas((lista) => {
      const nova = [...lista]
      const [item] = nova.splice(de, 1)
      nova.splice(para, 0, item)
      return nova
    })
  }

  /** Salva o quiz; devolve o quiz salvo ou null se algo deu errado. */
  async function gravar() {
    const encontrados = validar(form, perguntas)
    setErros(encontrados)
    setErroGeral('')
    setAviso('')
    if (Object.keys(encontrados).length) {
      setErroGeral('Confira os campos destacados.')
      return null
    }
    setSalvando(true)
    try {
      const resposta = await salvarQuiz(salvo?.quiz.id, paraEnvio(form, perguntas))
      setSalvo({ retrato: retrato(paraFormulario(resposta), resposta.perguntas), quiz: resposta })
      setPerguntas(resposta.perguntas)
      return resposta
    } catch (falha) {
      const doServidor = {}
      ;['titulo', 'disciplina_id', 'turma', 'descricao', 'tempo_padrao', 'pontuacao_padrao', 'perguntas_ids'].forEach(
        (campo) => {
          const mensagem = falha.doCampo?.(campo)
          if (mensagem) doServidor[campo] = mensagem
        },
      )
      if (falha.doCampo?.('status')) doServidor.perguntas_ids = falha.doCampo('status')
      setErros(doServidor)
      setErroGeral(Object.keys(doServidor).length ? 'Confira os campos destacados.' : falha.message)
      return null
    } finally {
      setSalvando(false)
    }
  }

  async function salvar(evento) {
    evento?.preventDefault()
    const novo = !salvo
    const resposta = await gravar()
    if (!resposta) return
    if (novo) navegar(`/adm/quiz/${resposta.id}/editar`, { replace: true, state: { aviso: 'Quiz salvo.' } })
    else setAviso('Quiz salvo.')
  }

  async function salvarDoModal(dados, arquivos) {
    if (!modal.pergunta) {
      // Pergunta nova: vai para o banco e entra no fim do quiz.
      const criada = await salvarPergunta(null, { ...dados, dificuldade: form.dificuldade }, arquivos)
      mudarPerguntas((lista) => [...lista, criada])
      setVersaoBanco((v) => v + 1)
      setModal(null)
      return
    }
    // Lápis: só vale para este quiz, então o quiz precisa estar salvo antes.
    const novo = !salvo
    const quizSalvo = alterado ? await gravar() : salvo.quiz
    if (!quizSalvo) {
      setModal(null)
      return
    }
    const editada = await editarPerguntaNoQuiz(quizSalvo.id, modal.pergunta.id, dados, arquivos)
    setModal(null)
    if (novo) {
      navegar(`/adm/quiz/${quizSalvo.id}/editar`, { replace: true, state: { aviso: 'Quiz salvo e pergunta atualizada.' } })
      return
    }
    const lista = (alterado ? quizSalvo.perguntas : perguntas).map((p) => (p.id === modal.pergunta.id ? editada : p))
    setPerguntas(lista)
    setSalvo({ retrato: retrato(alterado ? paraFormulario(quizSalvo) : form, lista), quiz: quizSalvo })
    setAviso('Pergunta atualizada só neste quiz.')
  }

  function digitarBusca(valor) {
    setBusca(valor)
    clearTimeout(esperaBusca.current)
    esperaBusca.current = setTimeout(() => setTermo(valor.trim()), ESPERA_BUSCA)
  }

  const idsNoQuiz = new Set(perguntas.map((p) => p.id))
  const erroDe = (campo) => erros[campo] && <span className={estilos.erro}>{erros[campo]}</span>

  return (
    <>
      <CabecalhoPagina sobretitulo="Editor" titulo={salvo ? 'Editar quiz' : 'Criar quiz'} />

      {aviso && (
        <div className={estilos.aviso}>
          <Alerta tipo="sucesso">{aviso}</Alerta>
        </div>
      )}

      <form className={estilos.layout} onSubmit={salvar} noValidate>
        <div className={estilos.principal}>
          <section className={estilos.cartao} aria-labelledby="titulo-informacoes">
            <h2 id="titulo-informacoes" className={estilos.tituloSecao}>
              Informações básicas
            </h2>

            <label className={estilos.campo}>
              <span className={estilos.rotulo}>Título *</span>
              <input
                className={estilos.entrada}
                maxLength={120}
                value={form.titulo}
                aria-invalid={Boolean(erros.titulo)}
                onChange={(e) => mudar('titulo', e.target.value)}
              />
              {erroDe('titulo')}
            </label>

            <label className={estilos.campo}>
              <span className={estilos.rotulo}>Descrição</span>
              <textarea
                className={`${estilos.entrada} ${estilos.descricao}`}
                maxLength={500}
                value={form.descricao}
                onChange={(e) => mudar('descricao', e.target.value)}
              />
            </label>

            <div className={estilos.grade}>
              <label className={estilos.campo}>
                <span className={estilos.rotulo}>Disciplina</span>
                <SeletorDisciplina
                  className={estilos.entrada}
                  valor={form.disciplina_id}
                  aoMudar={(valor) => mudar('disciplina_id', valor)}
                  disciplinas={disciplinas}
                  aoCadastrar={(nova) => setDisciplinas((lista) => ordenarPorNome([...lista, nova]))}
                  textoVazio="Sem disciplina"
                  descricaoModal="Adicione uma disciplina para usar neste quiz."
                  aria-invalid={Boolean(erros.disciplina_id)}
                />
                {erroDe('disciplina_id')}
              </label>
              <label className={estilos.campo}>
                <span className={estilos.rotulo}>Turma</span>
                <input
                  className={estilos.entrada}
                  maxLength={60}
                  placeholder="Opcional. Ex.: 8º ano A"
                  value={form.turma}
                  onChange={(e) => mudar('turma', e.target.value)}
                />
              </label>
              <label className={estilos.campo}>
                <span className={estilos.rotulo}>Dificuldade</span>
                <select
                  className={estilos.entrada}
                  value={form.dificuldade}
                  onChange={(e) => mudar('dificuldade', e.target.value)}
                >
                  {DIFICULDADES.map(({ valor, rotulo }) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </label>
              <label className={estilos.campo}>
                <span className={estilos.rotulo}>Tempo padrão</span>
                <input
                  className={estilos.entrada}
                  type="number"
                  min={LIMITES.tempo.min}
                  max={LIMITES.tempo.max}
                  value={form.tempo_padrao}
                  aria-invalid={Boolean(erros.tempo_padrao)}
                  aria-describedby="dica-padroes"
                  onChange={(e) => mudar('tempo_padrao', e.target.value)}
                />
                {erroDe('tempo_padrao')}
              </label>
              <label className={estilos.campo}>
                <span className={estilos.rotulo}>Pontuação</span>
                <input
                  className={estilos.entrada}
                  type="number"
                  min={LIMITES.pontuacao.min}
                  max={LIMITES.pontuacao.max}
                  step={100}
                  value={form.pontuacao_padrao}
                  aria-invalid={Boolean(erros.pontuacao_padrao)}
                  aria-describedby="dica-padroes"
                  onChange={(e) => mudar('pontuacao_padrao', e.target.value)}
                />
                {erroDe('pontuacao_padrao')}
              </label>
              <p id="dica-padroes" className={estilos.dica}>
                Tempo e pontuação já vêm preenchidos nas perguntas que você criar aqui.
              </p>
            </div>

            <div className={estilos.marcacoes}>
              <label className={estilos.marcacao}>
                <input
                  type="checkbox"
                  checked={form.embaralhar_respostas}
                  onChange={(e) => mudar('embaralhar_respostas', e.target.checked)}
                />
                Embaralhar respostas
              </label>
              <label className={estilos.marcacao}>
                <input
                  type="checkbox"
                  checked={form.embaralhar_perguntas}
                  onChange={(e) => mudar('embaralhar_perguntas', e.target.checked)}
                />
                Embaralhar perguntas
              </label>
              <label className={`${estilos.marcacao} ${estilos.publicar}`}>
                <input
                  type="checkbox"
                  checked={form.publicado}
                  onChange={(e) => {
                    mudar('publicado', e.target.checked)
                    setErros((er) => ({ ...er, perguntas_ids: undefined }))
                  }}
                />
                Publicar quiz <span className={estilos.dicaInline}>(só quiz publicado inicia partida)</span>
              </label>
            </div>
          </section>

          <section className={estilos.cartao} aria-labelledby="titulo-adicionadas">
            <div className={estilos.cabecalhoSecao}>
              <div>
                <h2 id="titulo-adicionadas" className={estilos.tituloSecao}>
                  Perguntas adicionadas
                </h2>
                <p className={estilos.subtitulo}>
                  {perguntas.length} {perguntas.length === 1 ? 'pergunta' : 'perguntas'}
                  {perguntas.length > 1 && ' · arraste para reordenar'}
                </p>
              </div>
              <button type="button" className={estilos.botaoCriar} onClick={() => setModal({ pergunta: null })}>
                Criar pergunta
              </button>
            </div>
            {erroDe('perguntas_ids')}

            {perguntas.length === 0 ? (
              <p className={estilos.vazio}>
                Nenhuma pergunta ainda. Marque perguntas do banco ao lado ou crie uma nova.
              </p>
            ) : (
              <ol className={estilos.lista}>
                {perguntas.map((pergunta, indice) => (
                  <li
                    key={pergunta.id}
                    className={`${estilos.item} ${arrastando === indice ? estilos.itemArrastando : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (arrastando !== null && arrastando !== indice) {
                        mover(arrastando, indice)
                        setArrastando(indice)
                      }
                    }}
                    onDrop={(e) => e.preventDefault()}
                  >
                    <button
                      type="button"
                      className={estilos.alca}
                      draggable
                      aria-label={`Mover: ${pergunta.texto}. Use as setas para cima e para baixo.`}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        setArrastando(indice)
                      }}
                      onDragEnd={() => setArrastando(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault()
                          mover(indice, indice + (e.key === 'ArrowUp' ? -1 : 1))
                        }
                      }}
                    >
                      <IconeAlca />
                    </button>
                    <strong className={estilos.textoItem}>
                      {indice + 1}. {pergunta.texto}
                      {pergunta.no_banco === false && <span className={estilos.seloSoQuiz}>só neste quiz</span>}
                    </strong>
                    <button
                      type="button"
                      className={estilos.acaoItem}
                      aria-label={`Editar neste quiz: ${pergunta.texto}`}
                      onClick={() => setModal({ pergunta })}
                    >
                      <IconeLapis />
                    </button>
                    <button
                      type="button"
                      className={`${estilos.acaoItem} ${estilos.remover}`}
                      aria-label={`Tirar do quiz: ${pergunta.texto}`}
                      onClick={() => mudarPerguntas((lista) => lista.filter((p) => p.id !== pergunta.id))}
                    >
                      <IconeLixeira />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className={estilos.lateral}>
          <section className={`${estilos.cartao} ${estilos.cartaoBanco}`} aria-labelledby="titulo-banco">
            <h2 id="titulo-banco" className={estilos.tituloBanco}>
              Banco de perguntas
            </h2>
            <input
              className={estilos.entrada}
              type="search"
              placeholder="Buscar pergunta"
              aria-label="Buscar pergunta no banco"
              value={busca}
              onChange={(e) => digitarBusca(e.target.value)}
            />
            <div className={estilos.banco} aria-busy={carregandoBanco}>
              {banco.erro ? (
                <Alerta>{banco.erro}</Alerta>
              ) : carregandoBanco && banco.termo === null ? (
                <Carregando texto="Carregando perguntas…" />
              ) : banco.itens.length === 0 ? (
                <p className={estilos.vazio}>
                  {termo ? 'Nenhuma pergunta encontrada.' : 'Seu banco ainda não tem perguntas ativas.'}
                </p>
              ) : (
                banco.itens.map((pergunta) => (
                  <label key={pergunta.id} className={estilos.opcaoBanco}>
                    <input
                      type="checkbox"
                      checked={idsNoQuiz.has(pergunta.id)}
                      onChange={() => alternarDoBanco(pergunta)}
                    />
                    <span>{pergunta.texto}</span>
                  </label>
                ))
              )}
            </div>

            <Alerta>{erroGeral}</Alerta>

            <div className={estilos.botoes}>
              <button type="submit" className={estilos.botaoSalvar} disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar quiz'}
              </button>
              <BotaoPainel
                icone={<IconePlay />}
                className={estilos.botaoIniciar}
                disabled={!podeIniciar}
                aria-describedby={podeIniciar ? undefined : 'dica-iniciar'}
                onClick={() => navegar(`/adm/quiz/${salvo.quiz.id}/partida`)}
              >
                Iniciar partida
              </BotaoPainel>
              {!podeIniciar && (
                <p id="dica-iniciar" className={estilos.dica}>
                  {alterado ? 'Salve o quiz publicado para iniciar uma partida.' : 'Publique o quiz para iniciar uma partida.'}
                </p>
              )}
            </div>
          </section>
        </aside>
      </form>

      {modal && (
        <ModalPerguntaQuiz
          pergunta={modal.pergunta}
          padroes={{ tempo: form.tempo_padrao, pontuacao: form.pontuacao_padrao }}
          aoFechar={() => setModal(null)}
          aoSalvar={salvarDoModal}
        />
      )}
    </>
  )
}

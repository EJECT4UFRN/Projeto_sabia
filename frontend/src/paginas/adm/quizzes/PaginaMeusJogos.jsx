import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Carregando from '../../../componentes/estados/Carregando'
import Alerta from '../../../componentes/formulario/Alerta'
import {
  IconeCopiar,
  IconeEstrela,
  IconeLapis,
  IconeLixeira,
  IconeLupa,
  IconeMaisPequeno,
  IconePlay,
} from '../../../componentes/icones/Icones'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import CabecalhoPagina from '../../../componentes/painel/CabecalhoPagina'
import Modal from '../../../componentes/painel/Modal'
import Paginacao from '../../../componentes/painel/Paginacao'
import { DIFICULDADES } from '../../../componentes/painel/dificuldades'
import {
  duplicarQuiz,
  excluirQuiz,
  listarDisciplinas,
  listarQuizzes,
  salvarQuiz,
} from '../../../servicos/quizzes'
import estilos from './PaginaMeusJogos.module.css'

const POR_PAGINA = 6
const ESPERA_BUSCA = 400
const rotuloDificuldade = Object.fromEntries(DIFICULDADES.map(({ valor, rotulo }) => [valor, rotulo]))

function lerFiltros(parametros) {
  return {
    busca: parametros.get('busca') ?? '',
    disciplina: parametros.get('disciplina') ?? '',
    status: parametros.get('status') ?? '',
    dificuldade: parametros.get('dificuldade') ?? '',
    pagina: Number(parametros.get('pagina')) || 1,
  }
}

/** "favoritos" mora no mesmo seletor do status, mas vira o filtro `favorito=true` na API. */
function paraApi({ busca, disciplina, status, dificuldade, pagina }) {
  return {
    busca,
    disciplina,
    dificuldade,
    pagina,
    status: status === 'favoritos' ? '' : status,
    favorito: status === 'favoritos' ? 'true' : '',
  }
}

const formatarData = (iso) => new Date(iso).toLocaleDateString('pt-BR')

export default function PaginaMeusJogos() {
  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)
  const local = useLocation()
  const navegar = useNavigate()

  const [busca, setBusca] = useState(filtros.busca)
  const esperaBusca = useRef(null)
  const [disciplinas, setDisciplinas] = useState([])
  const [versao, setVersao] = useState(0)
  const [carga, setCarga] = useState({ chave: null, resultado: null, erro: '' })
  const [aviso, setAviso] = useState(local.state?.aviso ?? '')
  const [erroAcao, setErroAcao] = useState('')
  const [ocupado, setOcupado] = useState(null)
  const [paraExcluir, setParaExcluir] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState('')

  const chaveFiltros = parametros.toString()
  const chave = `${chaveFiltros}#${versao}`
  const carregando = carga.chave !== chave
  const resultado = carga.resultado
  const erro = carregando ? '' : carga.erro
  const recarregar = () => setVersao((v) => v + 1)

  useEffect(() => {
    let ativo = true
    const atuais = lerFiltros(new URLSearchParams(chaveFiltros))
    listarQuizzes(paraApi(atuais))
      .then((dados) => ativo && setCarga({ chave, resultado: dados, erro: '' }))
      .catch((falha) => {
        if (!ativo) return
        if (falha.status === 404 && atuais.pagina > 1) {
          setParametros((p) => {
            p.delete('pagina')
            return p
          })
          return
        }
        setCarga((anterior) => ({ ...anterior, chave, erro: falha.message }))
      })
    return () => {
      ativo = false
    }
  }, [chave, chaveFiltros, setParametros])

  useEffect(() => {
    listarDisciplinas()
      .then(setDisciplinas)
      .catch(() => setDisciplinas([]))
  }, [versao])

  useEffect(() => {
    if (local.state?.aviso) navegar(`${local.pathname}${local.search}`, { replace: true, state: null })
  }, [local, navegar])

  useEffect(() => () => clearTimeout(esperaBusca.current), [])

  function mudarFiltro(nome, valor) {
    setParametros((p) => {
      if (valor) p.set(nome, valor)
      else p.delete(nome)
      p.delete('pagina')
      return p
    })
  }

  function digitarBusca(valor) {
    setBusca(valor)
    clearTimeout(esperaBusca.current)
    esperaBusca.current = setTimeout(() => mudarFiltro('busca', valor.trim()), ESPERA_BUSCA)
  }

  function enviarBusca(evento) {
    evento.preventDefault()
    clearTimeout(esperaBusca.current)
    mudarFiltro('busca', busca.trim())
  }

  function limparFiltros() {
    setBusca('')
    setParametros(new URLSearchParams())
  }

  function irParaPagina(pagina) {
    setParametros((p) => {
      if (pagina > 1) p.set('pagina', pagina)
      else p.delete('pagina')
      return p
    })
  }

  async function executar(quiz, acao) {
    setOcupado(quiz.id)
    setErroAcao('')
    try {
      await acao()
    } catch (falha) {
      setErroAcao(falha.message)
    } finally {
      setOcupado(null)
    }
  }

  const alternarFavorito = (quiz) =>
    executar(quiz, async () => {
      await salvarQuiz(quiz.id, { favorito: !quiz.favorito })
      recarregar()
    })

  const duplicar = (quiz) =>
    executar(quiz, async () => {
      const copia = await duplicarQuiz(quiz.id)
      setAviso(`Quiz duplicado: “${copia.titulo}”.`)
      if (filtros.pagina > 1) irParaPagina(1)
      else recarregar()
    })

  async function confirmarExclusao() {
    setExcluindo(true)
    setErroExclusao('')
    try {
      await excluirQuiz(paraExcluir.id)
      setAviso('Quiz excluído.')
      setParaExcluir(null)
      if (resultado.results.length <= 1 && filtros.pagina > 1) irParaPagina(filtros.pagina - 1)
      else recarregar()
    } catch (falha) {
      setErroExclusao(falha.message)
    } finally {
      setExcluindo(false)
    }
  }

  const temFiltro = Boolean(filtros.busca || filtros.disciplina || filtros.status || filtros.dificuldade)
  const total = resultado?.count ?? 0
  const quizzes = resultado?.results ?? []
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Biblioteca"
        titulo="Meus Jogos"
        descricao="Organize, edite e inicie suas atividades."
      >
        <BotaoPainel para="/adm/quiz/novo" icone={<IconeMaisPequeno />} className={estilos.botaoNovo}>
          Novo quiz
        </BotaoPainel>
      </CabecalhoPagina>

      {aviso && (
        <div className={estilos.aviso}>
          <Alerta tipo="sucesso">{aviso}</Alerta>
        </div>
      )}
      {erroAcao && (
        <div className={estilos.aviso}>
          <Alerta>{erroAcao}</Alerta>
        </div>
      )}

      <form className={estilos.filtros} role="search" onSubmit={enviarBusca}>
        <label className={estilos.busca}>
          <span className="visualmente-oculto">Buscar quiz</span>
          <span className={estilos.lupa}>
            <IconeLupa />
          </span>
          <input
            type="search"
            placeholder="Buscar quiz"
            value={busca}
            onChange={(e) => digitarBusca(e.target.value)}
          />
        </label>
        <select
          aria-label="Disciplina"
          className={estilos.seletor}
          value={filtros.disciplina}
          onChange={(e) => mudarFiltro('disciplina', e.target.value)}
        >
          <option value="">Todas as disciplinas</option>
          {disciplinas.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Dificuldade"
          className={estilos.seletor}
          value={filtros.dificuldade}
          onChange={(e) => mudarFiltro('dificuldade', e.target.value)}
        >
          <option value="">Todos os níveis</option>
          {DIFICULDADES.map(({ valor, rotulo }) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          className={estilos.seletor}
          value={filtros.status}
          onChange={(e) => mudarFiltro('status', e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="publicado">Publicados</option>
          <option value="rascunho">Rascunhos</option>
          <option value="favoritos">Favoritos</option>
        </select>
      </form>

      <section aria-label="Quizzes" aria-busy={carregando}>
        {erro ? (
          <div className={estilos.estado}>
            <Alerta>{erro}</Alerta>
            <BotaoPainel variante="contorno" onClick={recarregar}>
              Tentar de novo
            </BotaoPainel>
          </div>
        ) : carregando && !resultado ? (
          <Carregando texto="Carregando quizzes…" />
        ) : quizzes.length === 0 ? (
          <div className={estilos.estado}>
            {temFiltro ? (
              <>
                <p className={estilos.estadoTitulo}>Nenhum quiz encontrado</p>
                <p className={estilos.estadoTexto}>Tente outra busca ou mude os filtros.</p>
                <BotaoPainel variante="contorno" onClick={limparFiltros}>
                  Limpar filtros
                </BotaoPainel>
              </>
            ) : (
              <>
                <p className={estilos.estadoTitulo}>Você ainda não tem quizzes</p>
                <p className={estilos.estadoTexto}>Monte o primeiro com perguntas do seu banco.</p>
                <BotaoPainel para="/adm/quiz/novo" icone={<IconeMaisPequeno />}>
                  Novo quiz
                </BotaoPainel>
              </>
            )}
          </div>
        ) : (
          <>
            <ul className={`${estilos.grade} ${carregando ? estilos.atualizando : ''}`}>
              {quizzes.map((quiz) => {
                const publicado = quiz.status === 'publicado'
                const podeIniciar = publicado && quiz.perguntas_total > 0
                const travado = ocupado === quiz.id
                return (
                  <li key={quiz.id} className={estilos.cartao}>
                    <div className={estilos.topo}>
                      <span className={`${estilos.selo} ${publicado ? estilos.publicado : estilos.rascunho}`}>
                        {publicado ? 'Publicado' : 'Rascunho'}
                      </span>
                      <button
                        type="button"
                        className={`${estilos.estrela} ${quiz.favorito ? estilos.favorito : ''}`}
                        aria-pressed={quiz.favorito}
                        aria-label={`Favorito: ${quiz.titulo}`}
                        title={quiz.favorito ? 'Tirar dos favoritos' : 'Marcar como favorito'}
                        disabled={travado}
                        onClick={() => alternarFavorito(quiz)}
                      >
                        <IconeEstrela />
                      </button>
                    </div>
                    <h2 className={estilos.titulo}>{quiz.titulo}</h2>
                    <p className={estilos.detalhe}>
                      {quiz.disciplina || 'Sem disciplina'} · {quiz.perguntas_total}{' '}
                      {quiz.perguntas_total === 1 ? 'pergunta' : 'perguntas'} ·{' '}
                      {rotuloDificuldade[quiz.dificuldade]}
                      {quiz.turma && ` · ${quiz.turma}`}
                    </p>
                    <dl className={estilos.numeros}>
                      <div>
                        <dt>Atualizado em</dt>
                        <dd>{formatarData(quiz.atualizado_em)}</dd>
                      </div>
                      <div>
                        <dt>Partidas realizadas</dt>
                        <dd>{quiz.partidas_realizadas}</dd>
                      </div>
                    </dl>
                    <div className={estilos.acoes}>
                      <Link
                        to={`/adm/quiz/${quiz.id}/editar`}
                        className={`${estilos.acao} ${estilos.largo}`}
                        aria-label={`Editar: ${quiz.titulo}`}
                      >
                        <IconeLapis />
                      </Link>
                      <button
                        type="button"
                        className={estilos.acao}
                        aria-label={`Duplicar: ${quiz.titulo}`}
                        disabled={travado}
                        onClick={() => duplicar(quiz)}
                      >
                        <IconeCopiar />
                      </button>
                      {podeIniciar ? (
                        <Link
                          to={`/adm/quiz/${quiz.id}/partida`}
                          className={`${estilos.acao} ${estilos.largo} ${estilos.iniciar}`}
                          aria-label={`Iniciar partida: ${quiz.titulo}`}
                        >
                          <IconePlay />
                        </Link>
                      ) : (
                        <span
                          className={`${estilos.acao} ${estilos.largo} ${estilos.iniciar} ${estilos.desativado}`}
                          role="img"
                          aria-label={`Publique para iniciar: ${quiz.titulo}`}
                          title="Publique o quiz para iniciar uma partida"
                        >
                          <IconePlay />
                        </span>
                      )}
                      <button
                        type="button"
                        className={`${estilos.acao} ${estilos.excluir}`}
                        aria-label={`Excluir: ${quiz.titulo}`}
                        onClick={() => {
                          setErroExclusao('')
                          setParaExcluir(quiz)
                        }}
                      >
                        <IconeLixeira />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>

            <footer className={estilos.rodape}>
              <p className={estilos.contagem}>
                Exibindo <strong>{quizzes.length}</strong> de <strong>{total}</strong>{' '}
                <span className={estilos.unidade}>{total === 1 ? 'jogo' : 'jogos'}</span>
              </p>
              <Paginacao pagina={filtros.pagina} totalPaginas={totalPaginas} aoMudar={irParaPagina} />
            </footer>
          </>
        )}
      </section>

      <Modal
        aberto={Boolean(paraExcluir)}
        aoFechar={() => !excluindo && setParaExcluir(null)}
        sobretitulo="Meus jogos"
        titulo="Excluir quiz?"
        largura={480}
        rodape={
          <>
            <BotaoPainel variante="contorno" onClick={() => setParaExcluir(null)} disabled={excluindo}>
              Cancelar
            </BotaoPainel>
            <BotaoPainel variante="perigo" onClick={confirmarExclusao} disabled={excluindo}>
              {excluindo ? 'Excluindo…' : 'Excluir quiz'}
            </BotaoPainel>
          </>
        }
      >
        <p className={estilos.textoModal}>
          “{paraExcluir?.titulo}” será apagado. As perguntas do seu banco continuam lá; só as editadas
          exclusivamente para este quiz somem junto. Essa ação não pode ser desfeita.
        </p>
        <Alerta>{erroExclusao}</Alerta>
      </Modal>
    </>
  )
}

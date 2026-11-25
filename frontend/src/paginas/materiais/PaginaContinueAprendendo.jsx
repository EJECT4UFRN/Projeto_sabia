import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Carregando from '../../componentes/estados/Carregando'
import Alerta from '../../componentes/formulario/Alerta'
import { IconeBusca, IconeFunil, IconeSetaDireita, IconeSetaSelecao } from '../../componentes/icones/Icones'
import Paginacao from '../../componentes/painel/Paginacao'
import { listarEstudo } from '../../servicos/materiais'
import { useSessao } from '../../sessao/contexto'
import CapaMaterial from './CapaMaterial'
import { rotuloTipo, textoAcao } from './capas'
import estilos from './PaginaContinueAprendendo.module.css'

const POR_PAGINA = 6
const ESPERA_BUSCA = 400
const FORMATOS = [
  { valor: 'video', rotulo: 'Vídeos' },
  { valor: 'artigo', rotulo: 'Artigos' },
  { valor: 'documento', rotulo: 'PDFs' },
]

const primeiroNome = (usuario) => (usuario?.nome ?? '').trim().split(/\s+/)[0]

function lerFiltros(parametros) {
  return {
    busca: parametros.get('busca') ?? '',
    tipo: parametros.get('tipo') ?? '',
    pagina: Number(parametros.get('pagina')) || 1,
  }
}

/** "Continue aprendendo": aberto para todos. Visitante vê os públicos; estudante, também os da turma. */
export default function PaginaContinueAprendendo() {
  const { usuario, carregando: carregandoSessao } = useSessao()
  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)
  const [busca, setBusca] = useState(filtros.busca)
  const esperaBusca = useRef(null)
  const [versao, setVersao] = useState(0)
  const [carga, setCarga] = useState({ chave: null, resultado: null, erro: '' })

  const chaveFiltros = parametros.toString()
  // Recarrega quando a sessão termina de abrir (a lista muda para quem está logado).
  const chave = `${chaveFiltros}#${versao}#${usuario?.id ?? ''}`
  const carregando = carga.chave !== chave
  const resultado = carga.resultado
  const erro = carregando ? '' : carga.erro

  useEffect(() => {
    if (carregandoSessao) return undefined
    let ativo = true
    const { pagina, ...resto } = lerFiltros(new URLSearchParams(chaveFiltros))
    listarEstudo({ ...resto, pagina })
      .then((dados) => ativo && setCarga({ chave, resultado: dados, erro: '' }))
      .catch((falha) => {
        if (!ativo) return
        if (falha.status === 404 && pagina > 1) {
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
  }, [chave, chaveFiltros, carregandoSessao, setParametros])

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
    clearTimeout(esperaBusca.current)
    setBusca('')
    setParametros(new URLSearchParams())
  }

  function irParaPagina(pagina) {
    setParametros((p) => {
      if (pagina > 1) p.set('pagina', pagina)
      else p.delete('pagina')
      return p
    })
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const nome = primeiroNome(usuario)
  const temFiltro = Boolean(filtros.busca || filtros.tipo)
  const total = resultado?.count ?? 0
  const materiais = resultado?.results ?? []
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const ehEstudante = usuario && usuario.perfil !== 'professor'

  return (
    <div className={estilos.pagina}>
      <header className={estilos.topo}>
        <h1 className={estilos.titulo}>
          Continue aprendendo{nome ? ',' : '.'}
          {nome && <span className={estilos.nome}>{nome}.</span>}
        </h1>
        <p className={estilos.descricao}>
          Revise os temas das partidas e aprofunde seus conhecimentos com vídeos, artigos e guias preparados para você.
        </p>
      </header>

      <form className={estilos.filtros} role="search" onSubmit={enviarBusca}>
        <label className={estilos.busca}>
          <span className="visualmente-oculto">Buscar material</span>
          <span className={estilos.lupa}>
            <IconeBusca />
          </span>
          <input
            type="search"
            placeholder="Buscar por tema ou título..."
            value={busca}
            onChange={(e) => digitarBusca(e.target.value)}
          />
        </label>
        <label className={estilos.formato}>
          <span className="visualmente-oculto">Formato</span>
          <span className={estilos.funil}>
            <IconeFunil />
          </span>
          <select value={filtros.tipo} onChange={(e) => mudarFiltro('tipo', e.target.value)}>
            <option value="">Todos os formatos</option>
            {FORMATOS.map(({ valor, rotulo }) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <span className={estilos.setaFormato}>
            <IconeSetaSelecao />
          </span>
        </label>
        <div className={estilos.chips} role="group" aria-label="Formato">
          {FORMATOS.map(({ valor, rotulo }) => (
            <button
              key={valor}
              type="button"
              className={`${estilos.chip} ${filtros.tipo === valor ? estilos.chipAtivo : ''}`}
              aria-pressed={filtros.tipo === valor}
              onClick={() => mudarFiltro('tipo', filtros.tipo === valor ? '' : valor)}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </form>

      <section className={estilos.secao} aria-labelledby="titulo-materiais" aria-busy={carregando}>
        <div className={estilos.cabecaSecao}>
          <div>
            <p className={estilos.sobretitulo}>{temFiltro ? 'Resultados' : ehEstudante ? 'Recomendados' : 'Materiais'}</p>
            <h2 id="titulo-materiais" className={estilos.tituloSecao}>
              {temFiltro ? 'O que encontramos' : 'Para continuar seus estudos'}
            </h2>
          </div>
          {resultado && !carregando && (
            <p className={estilos.total}>{total === 1 ? '1 material' : `${total} materiais`}</p>
          )}
        </div>

        {erro ? (
          <div className={estilos.estado}>
            <Alerta>{erro}</Alerta>
            <button type="button" className={estilos.botaoEstado} onClick={() => setVersao((v) => v + 1)}>
              Tentar de novo
            </button>
          </div>
        ) : carregando && !resultado ? (
          <Carregando texto="Carregando materiais…" />
        ) : materiais.length === 0 ? (
          <div className={estilos.estado}>
            {temFiltro ? (
              <>
                <p className={estilos.estadoTitulo}>Nenhum material encontrado</p>
                <p className={estilos.estadoTexto}>Tente outra palavra ou outro formato.</p>
                <button type="button" className={estilos.botaoEstado} onClick={limparFiltros}>
                  Limpar busca
                </button>
              </>
            ) : usuario ? (
              <>
                <p className={estilos.estadoTitulo}>Nenhum material por aqui ainda</p>
                <p className={estilos.estadoTexto}>
                  Peça o código da turma ao seu professor e entre nela pelo{' '}
                  <Link to="/perfil">seu perfil</Link>. Os materiais da turma aparecem aqui.
                </p>
              </>
            ) : (
              <>
                <p className={estilos.estadoTitulo}>Nenhum material aberto ainda</p>
                <p className={estilos.estadoTexto}>
                  <Link to="/entrar">Entre na sua conta</Link> para ver os materiais da sua turma.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <ul className={`${estilos.grade} ${carregando ? estilos.atualizando : ''}`}>
              {materiais.map((material) => (
                <li key={material.id}>
                  <Link to={`/materiais/${material.id}`} className={estilos.cartao}>
                    <CapaMaterial material={material} />
                    <div className={estilos.corpo}>
                      <p className={estilos.linhaTipo}>
                        <span className={estilos.tipo}>{rotuloTipo(material)}</span>
                        <span className={estilos.disciplina}>{material.disciplina}</span>
                      </p>
                      <h3 className={estilos.tituloCartao}>{material.titulo}</h3>
                      {material.descricao && <p className={estilos.descricaoCartao}>{material.descricao}</p>}
                      <span className={estilos.acao}>
                        {textoAcao(material)}
                        <IconeSetaDireita />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <footer className={estilos.rodape}>
              <p className={estilos.contagem}>
                Exibindo <strong>{materiais.length}</strong> de <strong>{total}</strong> materiais
              </p>
              <Paginacao pagina={filtros.pagina} totalPaginas={totalPaginas} aoMudar={irParaPagina} />
            </footer>
          </>
        )}
      </section>
    </div>
  )
}

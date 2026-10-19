import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Carregando from '../../../componentes/estados/Carregando'
import Alerta from '../../../componentes/formulario/Alerta'
import {
  IconeArquivo,
  IconeBuscaVazia,
  IconeDocumento,
  IconeLapis,
  IconeLixeira,
  IconeLupa,
  IconeMaisCirculo,
  IconeOlho,
  IconeSincronizar,
  IconeVideo,
} from '../../../componentes/icones/Icones'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import CabecalhoPagina from '../../../componentes/painel/CabecalhoPagina'
import Modal from '../../../componentes/painel/Modal'
import Paginacao from '../../../componentes/painel/Paginacao'
import { listarDisciplinas } from '../../../servicos/escola'
import {
  excluirMaterial,
  listarMateriais,
  mudarStatusMaterial,
  resumoMateriais,
} from '../../../servicos/materiais'
import estilos from './PaginaMateriais.module.css'
import { TIPOS_MATERIAL, formatarData, plural, tipoMaterial } from './tiposMaterial'

const POR_PAGINA = 6
const ESPERA_BUSCA = 400
const NUMEROS = [
  { chave: 'publicados', rotulo: 'Publicados', Icone: IconeSincronizar, cor: 'azul' },
  { chave: 'rascunhos', rotulo: 'Rascunhos', Icone: IconeArquivo, cor: 'laranja' },
  { chave: 'videos', rotulo: 'Vídeos', Icone: IconeVideo, cor: 'azul' },
  { chave: 'documentos', rotulo: 'Documentos', Icone: IconeDocumento, cor: 'ambar' },
]

function lerFiltros(parametros) {
  return {
    busca: parametros.get('busca') ?? '',
    disciplina: parametros.get('disciplina') ?? '',
    tipo: parametros.get('tipo') ?? '',
    status: parametros.get('status') ?? '',
    pagina: Number(parametros.get('pagina')) || 1,
  }
}

export default function PaginaMateriais() {
  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)
  const local = useLocation()
  const navegar = useNavigate()

  const [busca, setBusca] = useState(filtros.busca)
  const esperaBusca = useRef(null)
  const [disciplinas, setDisciplinas] = useState([])
  const [resumo, setResumo] = useState(null)
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
    const { pagina, ...resto } = lerFiltros(new URLSearchParams(chaveFiltros))
    listarMateriais({ ...resto, pagina })
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
  }, [chave, chaveFiltros, setParametros])

  useEffect(() => {
    let ativo = true
    resumoMateriais()
      .then((dados) => ativo && setResumo(dados))
      .catch(() => ativo && setResumo(null))
    return () => {
      ativo = false
    }
  }, [versao])

  useEffect(() => {
    listarDisciplinas()
      .then(setDisciplinas)
      .catch(() => setDisciplinas([]))
  }, [])

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
  }

  async function alternarStatus(material) {
    const publicar = material.status !== 'publicado'
    setOcupado(material.id)
    setErroAcao('')
    setAviso('')
    try {
      await mudarStatusMaterial(material.id, publicar ? 'publicado' : 'rascunho')
      setAviso(publicar ? `“${material.titulo}” foi publicado.` : `“${material.titulo}” saiu do ar e virou rascunho.`)
      recarregar()
    } catch (falha) {
      const motivo = falha.doCampo?.('turmas_ids')
      setErroAcao(
        motivo ? `Não deu para publicar “${material.titulo}”: ${motivo} Abra o lápis para escolher.` : falha.message,
      )
    } finally {
      setOcupado(null)
    }
  }

  async function confirmarExclusao() {
    setExcluindo(true)
    setErroExclusao('')
    try {
      await excluirMaterial(paraExcluir.id)
      setAviso('Material excluído.')
      setParaExcluir(null)
      if (resultado.results.length <= 1 && filtros.pagina > 1) irParaPagina(filtros.pagina - 1)
      else recarregar()
    } catch (falha) {
      setErroExclusao(falha.message)
    } finally {
      setExcluindo(false)
    }
  }

  const temFiltro = Boolean(filtros.busca || filtros.disciplina || filtros.tipo || filtros.status)
  const total = resultado?.count ?? 0
  const materiais = resultado?.results ?? []
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <>
      <CabecalhoPagina
        migalhas={[{ rotulo: 'Dashboard', para: '/adm' }, { rotulo: 'Materiais' }]}
        titulo="Materiais de estudo"
        descricao="Gerencie os conteúdos disponibilizados para seus alunos."
      >
        <BotaoPainel para="/adm/materiais/novo" icone={<IconeMaisCirculo />} className={estilos.botaoNovo}>
          Novo material
        </BotaoPainel>
      </CabecalhoPagina>

      <section className={estilos.numeros} aria-label="Resumo dos materiais">
        {NUMEROS.map(({ chave: campo, rotulo, Icone, cor }) => (
          <article key={campo} className={estilos.numero}>
            <span className={`${estilos.iconeNumero} ${estilos[cor]}`}>
              <Icone />
            </span>
            <strong className={estilos.valor}>{resumo ? resumo[campo] : '–'}</strong>
            <span className={estilos.rotuloNumero}>{rotulo}</span>
          </article>
        ))}
      </section>

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

      <section className={estilos.filtros} aria-label="Busca e filtros">
        <form className={estilos.linhaFiltros} role="search" onSubmit={enviarBusca}>
          <label className={estilos.busca}>
            <span className="visualmente-oculto">Buscar material</span>
            <span className={estilos.lupa}>
              <IconeLupa />
            </span>
            <input
              type="search"
              placeholder="Buscar material..."
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
            <option value="">Disciplina</option>
            {disciplinas.map(({ id, nome }) => (
              <option key={id} value={String(id)}>
                {nome}
              </option>
            ))}
          </select>
          <select
            aria-label="Tipo"
            className={estilos.seletor}
            value={filtros.tipo}
            onChange={(e) => mudarFiltro('tipo', e.target.value)}
          >
            <option value="">Tipo</option>
            {TIPOS_MATERIAL.map(({ valor, rotulo }) => (
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
            <option value="">Status</option>
            <option value="publicado">Publicados</option>
            <option value="rascunho">Rascunhos</option>
          </select>
          <button type="button" className={estilos.limpar} onClick={limparFiltros} disabled={!temFiltro && !busca}>
            Limpar filtros
          </button>
        </form>
        <p className={estilos.encontrados} aria-live="polite">
          {resultado && !carregando ? plural(total, 'material encontrado', 'materiais encontrados') : ' '}
        </p>
      </section>

      <section aria-label="Materiais" aria-busy={carregando}>
        {erro ? (
          <div className={estilos.estado}>
            <Alerta>{erro}</Alerta>
            <BotaoPainel variante="contorno" onClick={recarregar}>
              Tentar de novo
            </BotaoPainel>
          </div>
        ) : carregando && !resultado ? (
          <Carregando texto="Carregando materiais…" />
        ) : materiais.length === 0 ? (
          <div className={estilos.estado}>
            <span className={estilos.iconeVazio}>
              <IconeBuscaVazia />
            </span>
            {temFiltro ? (
              <>
                <h2 className={estilos.estadoTitulo}>Nenhum material encontrado</h2>
                <p className={estilos.estadoTexto}>Ajuste os termos ou limpe os filtros.</p>
              </>
            ) : (
              <>
                <h2 className={estilos.estadoTitulo}>Você ainda não tem materiais</h2>
                <p className={estilos.estadoTexto}>Envie um PDF ou cole o link de um vídeo ou artigo.</p>
                <BotaoPainel para="/adm/materiais/novo" icone={<IconeMaisCirculo />}>
                  Novo material
                </BotaoPainel>
              </>
            )}
          </div>
        ) : (
          <ul className={`${estilos.grade} ${carregando ? estilos.atualizando : ''}`}>
            {materiais.map((material) => {
              const tipo = tipoMaterial(material.tipo)
              const publicado = material.status === 'publicado'
              const turmas = material.turmas.map((t) => t.nome)
              if (material.publico) turmas.unshift('Público')
              return (
                <li key={material.id} className={estilos.cartao}>
                  <div className={estilos.cabecaCartao}>
                    <span className={`${estilos.iconeTipo} ${estilos[material.tipo]}`}>
                      <tipo.Icone />
                    </span>
                    <div className={estilos.textos}>
                      <p className={estilos.etiquetas}>
                        <span className={`${estilos.selo} ${publicado ? estilos.publicado : estilos.rascunho}`}>
                          {publicado ? 'Publicado' : 'Rascunho'}
                        </span>
                        <span>{tipo.rotulo}</span>
                      </p>
                      <h2 className={estilos.titulo}>{material.titulo}</h2>
                      {material.descricao && <p className={estilos.descricao}>{material.descricao}</p>}
                    </div>
                  </div>
                  <p className={estilos.meta}>
                    <span>{material.disciplina_nome}</span>
                    {turmas.length > 0 && <span>{turmas.join(', ')}</span>}
                    <span>{formatarData(material.criado_em)}</span>
                    <span>{plural(material.visualizacoes, 'visualização', 'visualizações')}</span>
                  </p>
                  <div className={estilos.acoes}>
                    <Link
                      to={`/materiais/${material.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className={estilos.acao}
                      aria-label={`Ver como o estudante: ${material.titulo}`}
                      title="Ver como o estudante"
                    >
                      <IconeOlho />
                    </Link>
                    <Link
                      to={`/adm/materiais/${material.id}/editar`}
                      className={estilos.acao}
                      aria-label={`Editar: ${material.titulo}`}
                    >
                      <IconeLapis />
                    </Link>
                    <button
                      type="button"
                      className={`${estilos.acaoTexto} ${publicado ? '' : estilos.publicar}`}
                      disabled={ocupado === material.id}
                      onClick={() => alternarStatus(material)}
                    >
                      {publicado ? 'Tirar do ar' : 'Publicar'}
                    </button>
                    <button
                      type="button"
                      className={`${estilos.acao} ${estilos.excluir}`}
                      aria-label={`Excluir: ${material.titulo}`}
                      onClick={() => {
                        setErroExclusao('')
                        setParaExcluir(material)
                      }}
                    >
                      <IconeLixeira />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {!erro && resultado && (
          <footer className={estilos.rodape}>
            <p className={estilos.contagem}>
              {total === 0 ? (
                'Nenhum material encontrado'
              ) : (
                <>
                  Exibindo {materiais.length} de {total} {total === 1 ? 'material' : 'materiais'}
                </>
              )}
            </p>
            <Paginacao pagina={filtros.pagina} totalPaginas={totalPaginas} aoMudar={irParaPagina} />
          </footer>
        )}
      </section>

      <Modal
        aberto={Boolean(paraExcluir)}
        aoFechar={() => !excluindo && setParaExcluir(null)}
        sobretitulo="Materiais"
        titulo="Excluir material?"
        largura={480}
        rodape={
          <>
            <BotaoPainel variante="contorno" onClick={() => setParaExcluir(null)} disabled={excluindo}>
              Cancelar
            </BotaoPainel>
            <BotaoPainel variante="perigo" onClick={confirmarExclusao} disabled={excluindo}>
              {excluindo ? 'Excluindo…' : 'Excluir material'}
            </BotaoPainel>
          </>
        }
      >
        <p className={estilos.textoModal}>
          “{paraExcluir?.titulo}” some para os estudantes e o arquivo e a capa enviados são apagados. Essa ação
          não pode ser desfeita.
        </p>
        <Alerta>{erroExclusao}</Alerta>
      </Modal>
    </>
  )
}

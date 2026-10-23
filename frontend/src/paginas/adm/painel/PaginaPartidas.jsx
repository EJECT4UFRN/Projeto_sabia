import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Carregando from '../../../componentes/estados/Carregando'
import Alerta from '../../../componentes/formulario/Alerta'
import { IconeLupa } from '../../../componentes/icones/Icones'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import CabecalhoPagina from '../../../componentes/painel/CabecalhoPagina'
import Paginacao from '../../../componentes/painel/Paginacao'
import { listarPartidas } from '../../../servicos/painel'
import ListaPartidas from './ListaPartidas'
import estilos from './PaginaPartidas.module.css'

const POR_PAGINA = 10
const ESPERA_BUSCA = 400
const FILTROS = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'aguardando', rotulo: 'Aguardando' },
  { valor: 'finalizado', rotulo: 'Finalizadas' },
]

function lerFiltros(parametros) {
  return {
    busca: parametros.get('busca') ?? '',
    situacao: parametros.get('situacao') ?? '',
    pagina: Number(parametros.get('pagina')) || 1,
  }
}

/** "Minhas partidas": todas as salas do professor (o "Ver mais" da Dashboard). */
export default function PaginaPartidas() {
  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)
  const [busca, setBusca] = useState(filtros.busca)
  const espera = useRef(null)
  const [versao, setVersao] = useState(0)
  const [carga, setCarga] = useState({ chave: null, resultado: null, erro: '' })

  const chaveFiltros = parametros.toString()
  const chave = `${chaveFiltros}#${versao}`
  const carregando = carga.chave !== chave
  const resultado = carga.resultado
  const erro = carregando ? '' : carga.erro

  useEffect(() => {
    let vivo = true
    listarPartidas(lerFiltros(new URLSearchParams(chaveFiltros)))
      .then((dados) => vivo && setCarga({ chave, resultado: dados, erro: '' }))
      .catch((falha) => {
        if (!vivo) return
        if (falha.status === 404) {
          setParametros((p) => {
            p.delete('pagina')
            return p
          })
          return
        }
        setCarga((anterior) => ({ ...anterior, chave, erro: falha.message }))
      })
    return () => {
      vivo = false
    }
  }, [chave, chaveFiltros, setParametros])

  useEffect(() => () => clearTimeout(espera.current), [])

  function mudarFiltro(nome, valor) {
    setParametros((p) => {
      if (valor) p.set(nome, valor)
      else p.delete(nome)
      p.delete('pagina')
      return p
    })
  }

  function digitar(valor) {
    setBusca(valor)
    clearTimeout(espera.current)
    espera.current = setTimeout(() => mudarFiltro('busca', valor.trim()), ESPERA_BUSCA)
  }

  const partidas = resultado?.results ?? []
  const total = resultado?.count ?? 0
  const temFiltro = Boolean(filtros.busca || filtros.situacao)

  return (
    <>
      <CabecalhoPagina
        migalhas={[{ rotulo: 'Dashboard', para: '/adm' }, { rotulo: 'Partidas' }]}
        titulo="Minhas partidas"
        descricao="Todas as salas que você abriu. As ativas voltam para o telão; as terminadas abrem o relatório."
      />

      <form
        className={estilos.filtros}
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          clearTimeout(espera.current)
          mudarFiltro('busca', busca.trim())
        }}
      >
        <label className={estilos.busca}>
          <span className="visualmente-oculto">Buscar partida</span>
          <span className={estilos.lupa}>
            <IconeLupa />
          </span>
          <input
            type="search"
            placeholder="Buscar pelo nome do jogo ou PIN"
            value={busca}
            onChange={(e) => digitar(e.target.value)}
          />
        </label>
        <div className={estilos.chips} role="group" aria-label="Situação">
          {FILTROS.map(({ valor, rotulo }) => (
            <button
              key={rotulo}
              type="button"
              className={`${estilos.chip} ${filtros.situacao === valor ? estilos.chipAtivo : ''}`}
              aria-pressed={filtros.situacao === valor}
              onClick={() => mudarFiltro('situacao', valor)}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </form>

      <section aria-label="Partidas" aria-busy={carregando}>
        {erro ? (
          <div className={estilos.estado}>
            <Alerta>{erro}</Alerta>
            <BotaoPainel variante="contorno" onClick={() => setVersao((v) => v + 1)}>
              Tentar de novo
            </BotaoPainel>
          </div>
        ) : carregando && !resultado ? (
          <Carregando texto="Carregando partidas…" />
        ) : partidas.length === 0 ? (
          <div className={estilos.estado}>
            <p className={estilos.estadoTitulo}>
              {temFiltro ? 'Nenhuma partida encontrada' : 'Você ainda não abriu nenhuma sala'}
            </p>
            <p className={estilos.estadoTexto}>
              {temFiltro ? 'Tente outra busca ou outra situação.' : 'Abra uma sala em Meus jogos para jogar um quiz ao vivo.'}
            </p>
            {!temFiltro && (
              <BotaoPainel variante="escuro" para="/adm/quiz">
                Ir para Meus jogos
              </BotaoPainel>
            )}
          </div>
        ) : (
          <div className={carregando ? estilos.atualizando : ''}>
            <ListaPartidas partidas={partidas} />
            <footer className={estilos.rodape}>
              <p className={estilos.contagem}>
                Exibindo {partidas.length} de {total} {total === 1 ? 'partida' : 'partidas'}
              </p>
              <Paginacao
                pagina={filtros.pagina}
                totalPaginas={Math.max(1, Math.ceil(total / POR_PAGINA))}
                aoMudar={(pagina) =>
                  setParametros((p) => {
                    if (pagina > 1) p.set('pagina', pagina)
                    else p.delete('pagina')
                    return p
                  })
                }
              />
            </footer>
          </div>
        )}
      </section>
    </>
  )
}

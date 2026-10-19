import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Carregando from '../../componentes/estados/Carregando'
import Alerta from '../../componentes/formulario/Alerta'
import { IconePinPequeno } from '../../componentes/icones/Icones'
import Avatar from '../../componentes/usuario/Avatar'
import { listarHistorico, retomarPartida } from '../../servicos/historico'
import { guardarParticipacao } from '../../servicos/partidas'
import { useSessao } from '../../sessao/contexto'
import { formatarPin, formatarPontos } from '../partida/visual'
import estilos from './PaginaHistorico.module.css'

const formatarData = (iso) => new Date(iso).toLocaleDateString('pt-BR')

export default function PaginaHistorico() {
  const { usuario, sair } = useSessao()
  const navegar = useNavigate()
  const [carga, setCarga] = useState({ versao: null, dados: null, erro: '' })
  const [versao, setVersao] = useState(0)
  const [mais, setMais] = useState({ itens: [], pagina: 1, carregando: false, erro: '' })
  const [retomando, setRetomando] = useState(null)
  const [erroAcao, setErroAcao] = useState('')

  useEffect(() => {
    let ativo = true
    listarHistorico()
      .then((dados) => ativo && setCarga({ versao, dados, erro: '' }))
      .catch((falha) => ativo && setCarga({ versao, dados: null, erro: falha.message }))
    return () => {
      ativo = false
    }
  }, [versao])

  const carregando = carga.versao !== versao
  const dados = carga.dados
  const partidas = [...(dados?.results ?? []), ...mais.itens]
  const temMais = dados ? partidas.length < dados.count : false

  async function carregarMais() {
    const proxima = mais.pagina + 1
    setMais((m) => ({ ...m, carregando: true, erro: '' }))
    try {
      const pagina = await listarHistorico(proxima)
      setMais((m) => ({ itens: [...m.itens, ...pagina.results], pagina: proxima, carregando: false, erro: '' }))
    } catch (falha) {
      setMais((m) => ({ ...m, carregando: false, erro: falha.message }))
    }
  }

  async function retomar(partida) {
    setRetomando(partida.id)
    setErroAcao('')
    try {
      const dadosRetomada = await retomarPartida(partida.id)
      guardarParticipacao(dadosRetomada)
      navegar(`/jogo/${dadosRetomada.pin}`)
    } catch (falha) {
      setErroAcao(falha.message)
      setRetomando(null)
      if (falha.status === 409) setVersao((v) => v + 1)
    }
  }

  async function sairDaConta() {
    await sair()
    navegar('/entrar')
  }

  return (
    <section className={estilos.pagina}>
      <header className={estilos.cabecalho}>
        <Avatar iniciais={usuario.iniciais} cor={usuario.cor_avatar} tamanho={112} quadrado />
        <div>
          <p className={estilos.sobretitulo}>Meu histórico</p>
          <h1 className={estilos.nome}>{usuario.nome}</h1>
        </div>
      </header>

      {carregando && !dados ? (
        <Carregando texto="Carregando seu histórico…" />
      ) : carga.erro ? (
        <div className={estilos.estado}>
          <Alerta>{carga.erro}</Alerta>
          <button type="button" className={estilos.botaoContorno} onClick={() => setVersao((v) => v + 1)}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <>
          <dl className={estilos.numeros}>
            <div>
              <dt>Partidas</dt>
              <dd className={estilos.azul}>{dados.resumo.partidas}</dd>
            </div>
            <div>
              <dt>Recorde</dt>
              <dd className={estilos.laranja}>{formatarPontos(dados.resumo.recorde)}</dd>
            </div>
            <div>
              <dt>Pts totais</dt>
              <dd>{formatarPontos(dados.resumo.pontos_totais)}</dd>
            </div>
          </dl>

          <h2 className={estilos.sobretitulo}>Últimas partidas</h2>
          <Alerta>{erroAcao}</Alerta>
          {partidas.length === 0 ? (
            <div className={estilos.vazio}>
              <p>Você ainda não jogou nenhuma partida com sua conta.</p>
              <Link to="/entrar-pin" className={estilos.botaoGradiente}>
                Entrar com PIN
              </Link>
            </div>
          ) : (
            <ul className={estilos.lista}>
              {partidas.map((partida) => {
                const recorde = partida.pontos > 0 && partida.pontos === dados.resumo.recorde
                const emCurso = partida.estado === 'em_curso'
                const conteudo = (
                  <>
                    <span className={`${estilos.pontos} ${recorde ? estilos.pontosRecorde : ''}`}>
                      <strong>{formatarPontos(partida.pontos)}</strong>
                      <small>pts</small>
                    </span>
                    <span className={estilos.info}>
                      <strong className={estilos.titulo}>{partida.titulo}</strong>
                      <span className={estilos.meta}>
                        <span className={estilos.pin}>
                          <IconePinPequeno aria-hidden="true" />
                          {formatarPin(partida.pin)}
                        </span>
                        <span>{formatarData(partida.data)}</span>
                        {partida.posicao && (
                          <span>
                            {partida.posicao}º de {partida.participantes}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className={`${estilos.selo} ${emCurso ? estilos.seloEmCurso : ''}`}>
                      {emCurso ? (retomando === partida.id ? 'Voltando…' : 'Em curso') : 'Encerrada'}
                    </span>
                  </>
                )
                return (
                  <li key={partida.id}>
                    {emCurso ? (
                      <button
                        type="button"
                        className={estilos.cartao}
                        onClick={() => retomar(partida)}
                        disabled={retomando === partida.id}
                        aria-label={`Voltar para a partida ${partida.titulo}`}
                      >
                        {conteudo}
                      </button>
                    ) : (
                      <Link
                        to={`/historico/${partida.id}`}
                        className={estilos.cartao}
                        aria-label={`Ver resumo: ${partida.titulo}`}
                      >
                        {conteudo}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <Alerta>{mais.erro}</Alerta>
          {temMais && (
            <button
              type="button"
              className={estilos.botaoContorno}
              onClick={carregarMais}
              disabled={mais.carregando}
            >
              {mais.carregando ? 'Carregando…' : 'Carregar mais'}
            </button>
          )}
        </>
      )}

      <footer className={estilos.rodape}>
        <Link to="/perfil">Editar perfil</Link>
        <button type="button" onClick={sairDaConta}>
          Sair
        </button>
      </footer>
    </section>
  )
}

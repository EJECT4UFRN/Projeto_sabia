import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import Carregando from '../../../componentes/estados/Carregando'
import Alerta from '../../../componentes/formulario/Alerta'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import CabecalhoPagina from '../../../componentes/painel/CabecalhoPagina'
import { buscarRelatorio } from '../../../servicos/painel'
import { VISUAL_ALTERNATIVAS, formatarPin, formatarPontos, formatarSegundos } from '../../partida/visual'
import estilos from './PaginaRelatorio.module.css'

const COLUNAS_PODIO = [
  { posicao: 2, classe: 'prata' },
  { posicao: 1, classe: 'ouro' },
  { posicao: 3, classe: 'bronze' },
]

function quando(iso) {
  if (!iso) return ''
  const data = new Date(iso)
  return `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

/** Relatório da partida encerrada: pódio, números, ranking completo e acerto por pergunta. */
export default function PaginaRelatorio() {
  const { id } = useParams()
  const [versao, setVersao] = useState(0)
  const chave = `${id}#${versao}`
  const [carga, setCarga] = useState({ chave: null, dados: null, erro: '', status: 0 })

  useEffect(() => {
    let vivo = true
    buscarRelatorio(id)
      .then((dados) => vivo && setCarga({ chave, dados, erro: '', status: 200 }))
      .catch((falha) => vivo && setCarga({ chave, dados: null, erro: falha.message, status: falha.status }))
    return () => {
      vivo = false
    }
  }, [chave, id])

  const migalhas = (titulo) => [
    { rotulo: 'Dashboard', para: '/adm' },
    { rotulo: 'Partidas', para: '/adm/partidas' },
    { rotulo: titulo },
  ]

  if (carga.chave !== chave) {
    return (
      <>
        <CabecalhoPagina migalhas={migalhas('Relatório')} titulo="Relatório da partida" />
        <Carregando texto="Montando o relatório…" />
      </>
    )
  }
  // Partida ainda em andamento: o lugar dela é o telão.
  if (carga.status === 409) return <Navigate to={`/adm/partidas/${id}`} replace />
  if (carga.erro) {
    return (
      <>
        <CabecalhoPagina migalhas={migalhas('Relatório')} titulo="Relatório da partida" />
        <div className={estilos.estado}>
          <Alerta>{carga.status === 404 ? 'Esta partida não existe mais.' : carga.erro}</Alerta>
          <div className={estilos.botoes}>
            <BotaoPainel variante="contorno" para="/adm/partidas">
              Voltar para as partidas
            </BotaoPainel>
            {carga.status !== 404 && (
              <BotaoPainel variante="escuro" onClick={() => setVersao((v) => v + 1)}>
                Tentar de novo
              </BotaoPainel>
            )}
          </div>
        </div>
      </>
    )
  }

  const dados = carga.dados
  const { estatisticas, ranking } = dados
  const porPosicao = Object.fromEntries(ranking.map((linha) => [linha.posicao, linha]))

  return (
    <>
      <CabecalhoPagina
        migalhas={migalhas(dados.titulo)}
        sobretitulo="Relatório da partida"
        titulo={dados.titulo}
        descricao={[
          dados.disciplina,
          `PIN ${formatarPin(dados.pin)}`,
          dados.encerrada_em && `encerrada em ${quando(dados.encerrada_em)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      {ranking.length === 0 ? (
        <div className={estilos.estado}>
          <p className={estilos.estadoTitulo}>Ninguém jogou esta partida</p>
          <p className={estilos.estadoTexto}>A sala foi encerrada sem jogadores na sala.</p>
        </div>
      ) : (
        <div className={estilos.relatorio}>
          <section className={estilos.palco} aria-label="Pódio">
            <ol className={estilos.podio}>
              {COLUNAS_PODIO.map(({ posicao, classe }) => {
                const linha = porPosicao[posicao]
                return (
                  <li
                    key={posicao}
                    className={`${estilos.coluna} ${estilos[classe]} ${linha ? '' : estilos.vaga}`}
                    aria-label={linha ? `${posicao}º lugar: ${linha.apelido}, ${formatarPontos(linha.pontos)} pontos` : `${posicao}º lugar vago`}
                  >
                    <span className={estilos.nomePodio}>{linha?.apelido ?? ' '}</span>
                    <span className={estilos.degrau}>
                      <span className={estilos.medalha}>{posicao}</span>
                      {linha && <span className={estilos.pontosPodio}>{formatarPontos(linha.pontos)}</span>}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          <dl className={estilos.numeros}>
            <div className={estilos.numero}>
              <dt>Jogadores</dt>
              <dd>{estatisticas.participantes}</dd>
            </div>
            <div className={estilos.numero}>
              <dt>Média de acertos</dt>
              <dd>{estatisticas.media_acertos}%</dd>
            </div>
            <div className={estilos.numero}>
              <dt>Tempo médio</dt>
              <dd>{formatarSegundos(estatisticas.tempo_medio)}</dd>
            </div>
            <div className={estilos.numero}>
              <dt>Mais difícil</dt>
              <dd>
                {estatisticas.mais_dificil
                  ? `Pergunta ${estatisticas.mais_dificil.numero} · ${estatisticas.mais_dificil.percentual}%`
                  : '—'}
              </dd>
            </div>
          </dl>

          <div className={estilos.colunas}>
            <section className={estilos.cartao} aria-labelledby="titulo-ranking">
              <h2 id="titulo-ranking" className={estilos.tituloSecao}>
                Ranking completo
              </h2>
              <table className={estilos.tabela}>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Jogador</th>
                    <th scope="col" className={estilos.numeroColuna}>
                      Acertos
                    </th>
                    <th scope="col" className={estilos.numeroColuna}>
                      Pontos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((linha) => (
                    <tr key={linha.id}>
                      <td className={estilos.posicao}>{linha.posicao}º</td>
                      <td>
                        {linha.apelido}
                        {!linha.com_conta && <span className={estilos.convidado}>convidado</span>}
                      </td>
                      <td className={estilos.numeroColuna}>
                        {linha.acertos}/{dados.total_perguntas}
                      </td>
                      <td className={`${estilos.numeroColuna} ${estilos.pontos}`}>{formatarPontos(linha.pontos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className={estilos.cartao} aria-labelledby="titulo-perguntas">
              <h2 id="titulo-perguntas" className={estilos.tituloSecao}>
                Acerto por pergunta
              </h2>
              <ol className={estilos.perguntas}>
                {dados.perguntas.map((pergunta) => (
                  <li key={pergunta.numero} className={estilos.pergunta}>
                    <div className={estilos.cabecaPergunta}>
                      <span className={estilos.numeroPergunta}>{pergunta.numero}</span>
                      <p className={estilos.textoPergunta}>{pergunta.texto}</p>
                      <strong
                        className={`${estilos.percentual} ${pergunta.percentual >= 70 ? estilos.bom : pergunta.percentual < 40 ? estilos.ruim : ''}`}
                      >
                        {pergunta.percentual}%
                      </strong>
                    </div>
                    <div
                      className={estilos.barra}
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pergunta.percentual}
                      aria-label={`Acertos da pergunta ${pergunta.numero}`}
                    >
                      <span style={{ width: `${pergunta.percentual}%` }} />
                    </div>
                    <p className={estilos.detalhePergunta}>
                      Resposta certa: <strong>{pergunta.resposta_correta}</strong> · {pergunta.acertaram} de{' '}
                      {estatisticas.participantes} acertaram
                    </p>
                    <ul className={estilos.distribuicao} aria-label={`Respostas da pergunta ${pergunta.numero}`}>
                      {pergunta.distribuicao.map((item, indice) => {
                        const visual = VISUAL_ALTERNATIVAS[indice]
                        return (
                          <li
                            key={item.letra}
                            className={`${estilos.alternativa} ${estilos[visual.classe]} ${item.correta ? estilos.certa : ''}`}
                            title={item.texto}
                          >
                            <visual.Icone aria-hidden="true" />
                            <span className="visualmente-oculto">
                              {item.texto}
                              {item.correta ? ' (certa)' : ''}:{' '}
                            </span>
                            <span>{item.quantidade}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}
    </>
  )
}

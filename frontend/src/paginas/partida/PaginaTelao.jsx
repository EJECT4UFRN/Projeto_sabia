import QRCode from 'qrcode'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Carregando from '../../componentes/estados/Carregando'
import Logo from '../../componentes/marca/Logo'
import { IconeCorreto, IconeFechar, IconePlay, IconeSetaDireita } from '../../componentes/icones/Icones'
import { abrirSala, buscarPartida, enderecoDaPartida } from '../../servicos/partidas'
import { Alternativa, FundoPartida, MarcaPartida, Podio, Variacao } from './Partida'
import estilos from './PaginaTelao.module.css'
import { usePartidaAoVivo, useTempoRestante } from './usePartidaAoVivo'
import { formatarPin, formatarPontos, formatarSegundos, ordinal } from './visual'

/** Telão do professor: sala de espera, perguntas, resultados, ranking e encerramento. */
export default function PaginaTelao() {
  const { id } = useParams()
  // Busca a partida pela API antes de cada conexão: além do PIN, isso renova o token se expirou.
  const obterEndereco = useCallback(async () => {
    const partida = await buscarPartida(id)
    return enderecoDaPartida(partida.pin)
  }, [id])
  const { estado, conexao, aviso, enviar, desvio } = usePartidaAoVivo(obterEndereco)

  if (!estado) {
    return (
      <FundoPartida>
        <div className={estilos.centro}>
          {conexao === 'encerrada' ? (
            <>
              <p className={estilos.mensagem}>{aviso || 'Não foi possível abrir esta sala.'}</p>
              <Link to="/adm/quiz" className={estilos.botaoContorno}>
                Voltar para Meus jogos
              </Link>
            </>
          ) : (
            <Carregando texto="Abrindo a sala…" />
          )}
        </div>
      </FundoPartida>
    )
  }

  const telas = {
    sala: TelaSala,
    pergunta: TelaPergunta,
    resultado: TelaResultado,
    ranking: TelaRanking,
    encerrada: TelaConcluida,
    cancelada: TelaCancelada,
  }
  const Tela = telas[estado.partida.estado] ?? TelaCancelada
  return (
    <>
      {conexao === 'reconectando' && (
        <p className={estilos.faixa} role="status">
          Conexão perdida. Reconectando…
        </p>
      )}
      {aviso && (
        <p className={`${estilos.faixa} ${estilos.faixaErro}`} role="alert">
          {aviso}
        </p>
      )}
      <Tela estado={estado} enviar={enviar} desvio={desvio} />
    </>
  )
}

function Topo({ partida, comPergunta }) {
  return (
    <header className={estilos.topo}>
      <MarcaPartida />
      {comPergunta ? (
        <div className={estilos.contador}>
          <span>PIN {formatarPin(partida.pin)}</span>
          <strong>
            Pergunta {partida.numero} de {partida.total_perguntas}
          </strong>
        </div>
      ) : (
        <p className={estilos.tituloQuiz}>{partida.titulo}</p>
      )}
    </header>
  )
}

// ----- sala de espera ----------------------------------------------------------------------------

function useQrCode(texto) {
  const [imagem, setImagem] = useState({ texto: null, url: '' })
  useEffect(() => {
    let ativo = true
    QRCode.toDataURL(texto, { margin: 1, width: 500, color: { dark: '#0a374e', light: '#ffffff' } })
      .then((url) => ativo && setImagem({ texto, url }))
      .catch(() => ativo && setImagem({ texto, url: '' }))
    return () => {
      ativo = false
    }
  }, [texto])
  return imagem.texto === texto ? imagem.url : ''
}

function TelaSala({ estado, enviar }) {
  const { partida, participantes } = estado
  const linkEntrada = `${window.location.origin}/entrar-pin?pin=${partida.pin}`
  const qr = useQrCode(linkEntrada)
  const [paraRemover, setParaRemover] = useState(null)

  return (
    <FundoPartida>
      <div className={estilos.pagina}>
        <Topo partida={partida} />
        <main className={estilos.sala}>
          <section className={estilos.blocoPin} aria-label="Como entrar na sala">
            <p className={estilos.chamadaPin}>Entre na sala usando esse PIN</p>
            <p className={estilos.pin} aria-label={`PIN ${partida.pin.split('').join(' ')}`}>
              {formatarPin(partida.pin)}
            </p>
            <div className={estilos.qr}>{qr && <img src={qr} alt={`QR Code para entrar na sala ${partida.pin}`} />}</div>
            <p className={estilos.legendaQr}>Acesse a sala lendo o QR Code</p>
            <p className={estilos.endereco}>ou acesse {window.location.host}/entrar-pin</p>
          </section>

          <section className={estilos.blocoParticipantes} aria-label="Participantes">
            <div className={estilos.cabecalhoParticipantes}>
              <div>
                <p className={estilos.rotuloParticipantes}>Participantes</p>
                <h1 className={estilos.totalParticipantes}>
                  {participantes.length} {participantes.length === 1 ? 'estudante' : 'estudantes'}
                </h1>
              </div>
              <span className={estilos.seloSala}>
                Sala aberta · {participantes.length}/{partida.limite}
              </span>
            </div>
            {participantes.length === 0 ? (
              <p className={estilos.esperando}>Esperando os estudantes entrarem…</p>
            ) : (
              <ul className={estilos.nomes}>
                {participantes.map((p) => (
                  <li key={p.id} className={estilos.nome}>
                    <span>{p.apelido}</span>
                    {paraRemover === p.id ? (
                      <span className={estilos.confirmarRemocao}>
                        <button
                          type="button"
                          onClick={() => {
                            enviar('remover', { participante: p.id })
                            setParaRemover(null)
                          }}
                        >
                          Remover
                        </button>
                        <button type="button" onClick={() => setParaRemover(null)}>
                          Manter
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={estilos.remover}
                        aria-label={`Remover ${p.apelido} da sala`}
                        onClick={() => setParaRemover(p.id)}
                      >
                        <IconeFechar />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
        <footer className={estilos.rodape}>
          <button type="button" className={estilos.botaoContorno} onClick={() => enviar('encerrar_partida')}>
            Cancelar sala
          </button>
          <button
            type="button"
            className={estilos.botaoGradiente}
            disabled={participantes.length === 0}
            onClick={() => enviar('iniciar')}
          >
            <IconePlay /> Iniciar jogo
          </button>
        </footer>
      </div>
    </FundoPartida>
  )
}

// ----- pergunta ----------------------------------------------------------------------------------

function TelaPergunta({ estado, enviar, desvio }) {
  const { partida, pergunta } = estado
  const restante = useTempoRestante(pergunta.prazo, desvio)

  return (
    <div className={estilos.telaPergunta}>
      <div className={estilos.pagina}>
        <Topo partida={partida} comPergunta />
        <div className={estilos.linhaStatus}>
          <p className={estilos.responderam} aria-live="polite">
            {estado.respondidos} de {partida.participantes} responderam
          </p>
          <span className={estilos.relogio} role="timer" aria-label={`${restante} segundos restantes`}>
            {restante}
          </span>
        </div>
        <div className={estilos.cartaoPergunta}>
          {pergunta.imagem && <img src={pergunta.imagem} alt="" className={estilos.imagemPergunta} />}
          <h1>{pergunta.texto}</h1>
        </div>
        <div className={estilos.gradeAlternativas}>
          {pergunta.alternativas.map((alt, posicao) => (
            <Alternativa key={alt.letra} posicao={posicao} texto={alt.texto} />
          ))}
        </div>
        <div className={estilos.acoesCentro}>
          <button
            type="button"
            className={estilos.botaoLaranja}
            onClick={() => enviar('encerrar_respostas', { numero: partida.numero })}
          >
            Encerrar respostas
          </button>
        </div>
      </div>
    </div>
  )
}

// ----- resultado da pergunta ---------------------------------------------------------------------

function BotaoAvancar({ partida, enviar }) {
  const ultima = partida.numero >= partida.total_perguntas
  return (
    <button type="button" className={estilos.botaoLaranja} onClick={() => enviar('proxima')}>
      {ultima ? 'Ver resultado final' : 'Próxima pergunta'} <IconeSetaDireita />
    </button>
  )
}

function TelaResultado({ estado, enviar }) {
  const { partida, pergunta, resultado } = estado
  return (
    <FundoPartida>
      <div className={estilos.pagina}>
        <Topo partida={partida} comPergunta />
        <main className={estilos.resultado}>
          <p className={estilos.sobretitulo}>Resultado da pergunta</p>
          <h1 className={estilos.tituloResultado}>{pergunta.texto}</h1>
          <div className={estilos.colunasResultado}>
            <section className={estilos.cartaoBranco} aria-label="Distribuição das respostas">
              <h2>Distribuição das respostas</h2>
              <ul className={estilos.barras}>
                {resultado.distribuicao.map((item, posicao) => (
                  <li key={item.letra}>
                    <div className={estilos.legendaBarra}>
                      <strong>
                        {item.texto}
                        {item.correta && (
                          <span className={estilos.marcaCorreta}>
                            <IconeCorreto /> correta
                          </span>
                        )}
                      </strong>
                      <span>
                        {item.quantidade} · {item.percentual}%
                      </span>
                    </div>
                    <div className={estilos.trilho}>
                      <span
                        className={`${estilos.barra} ${estilos[`barra${posicao}`]}`}
                        style={{ width: `${item.percentual}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <div className={estilos.numerosResultado}>
              <div className={`${estilos.numero} ${estilos.numeroAcerto}`}>
                <span>Acertaram</span>
                <strong>{resultado.acertaram}</strong>
              </div>
              <div className={`${estilos.numero} ${estilos.numeroErro}`}>
                <span>Erraram</span>
                <strong>{resultado.erraram}</strong>
              </div>
              <div className={`${estilos.numero} ${estilos.numeroTempo}`}>
                <span>Tempo médio</span>
                <strong>{formatarSegundos(resultado.tempo_medio)}</strong>
              </div>
            </div>
          </div>
          <div className={estilos.acoesDireita}>
            <button type="button" className={estilos.botaoContorno} onClick={() => enviar('mostrar_ranking')}>
              Ver ranking
            </button>
            <BotaoAvancar partida={partida} enviar={enviar} />
          </div>
        </main>
      </div>
    </FundoPartida>
  )
}

// ----- ranking parcial ---------------------------------------------------------------------------

function TelaRanking({ estado, enviar }) {
  const { partida, ranking } = estado
  return (
    <FundoPartida>
      <div className={estilos.pagina}>
        <Topo partida={partida} comPergunta />
        <main className={estilos.ranking}>
          <h1 className={estilos.tituloRanking}>Quem está voando mais alto?</h1>
          <ol className={estilos.listaRanking}>
            {ranking.map((linha) => (
              <li key={linha.id} className={`${estilos.linhaRanking} ${estilos[`lugar${Math.min(linha.posicao, 4)}`]}`}>
                <strong className={estilos.posicao}>{ordinal(linha.posicao)}</strong>
                <span className={estilos.apelido}>{linha.apelido}</span>
                {linha.sequencia > 0 && (
                  <span className={estilos.sequencia} title={`${linha.sequencia} acertos seguidos`}>
                    {linha.posicao <= 3 ? '🔥 ' : ''}
                    {linha.sequencia}
                  </span>
                )}
                <strong className={estilos.pontos}>{formatarPontos(linha.pontos)}</strong>
                <Variacao valor={linha.variacao} />
              </li>
            ))}
          </ol>
          <div className={estilos.acoesCentro}>
            <button type="button" className={estilos.linkEncerrar} onClick={() => enviar('encerrar_partida')}>
              Encerrar
            </button>
            <BotaoAvancar partida={partida} enviar={enviar} />
          </div>
        </main>
      </div>
    </FundoPartida>
  )
}

// ----- partida concluída -------------------------------------------------------------------------

function TelaConcluida({ estado }) {
  const { partida, ranking, estatisticas } = estado
  const navegar = useNavigate()
  const [abrindo, setAbrindo] = useState(false)
  const [erro, setErro] = useState('')

  async function jogarNovamente() {
    setAbrindo(true)
    setErro('')
    try {
      const nova = await abrirSala(partida.quiz_id, partida.limite)
      navegar(`/adm/partidas/${nova.id}`)
    } catch (falha) {
      setErro(falha.doCampo?.('quiz') ?? falha.message)
      setAbrindo(false)
    }
  }

  return (
    <FundoPartida>
      <div className={estilos.concluida}>
        <div className={estilos.marcaCentral}>
          <Logo variante="laranja" largura={125} semTexto />
        </div>
        <h1 className={estilos.tituloConcluida}>Partida concluída!</h1>
        <p className={estilos.detalheConcluida}>
          {partida.titulo} · {estatisticas.participantes}{' '}
          {estatisticas.participantes === 1 ? 'participante' : 'participantes'}
        </p>
        <Podio ranking={ranking.slice(0, 3)} nuvens />

        <section className={estilos.estatisticas} aria-label="Resumo da partida">
          <div className={estilos.estatistica}>
            <span>Participantes</span>
            <strong>{estatisticas.participantes}</strong>
          </div>
          <div className={estilos.estatistica}>
            <span>Média de acertos</span>
            <strong className={estilos.verde}>{estatisticas.media_acertos}%</strong>
          </div>
          <div className={estilos.estatistica}>
            <span>Tempo médio</span>
            <strong>{formatarSegundos(estatisticas.tempo_medio)}</strong>
          </div>
          <div className={estilos.estatistica}>
            <span>Mais difícil</span>
            <strong className={estilos.menor}>
              {estatisticas.mais_dificil ? `Pergunta ${estatisticas.mais_dificil.numero}` : '—'}
            </strong>
          </div>
          <div className={estilos.estatistica}>
            <span>Maior acerto</span>
            <strong className={estilos.menor}>
              {estatisticas.maior_acerto
                ? `Pergunta ${estatisticas.maior_acerto.numero} · ${estatisticas.maior_acerto.percentual}%`
                : '—'}
            </strong>
          </div>
        </section>

        <section className={estilos.tabelaRanking} aria-labelledby="titulo-ranking-geral">
          <h2 id="titulo-ranking-geral">Ranking geral</h2>
          {ranking.length === 0 ? (
            <p className={estilos.semParticipantes}>Ninguém participou desta partida.</p>
          ) : (
            <div className={estilos.rolagemTabela}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Posição</th>
                    <th scope="col">Estudante</th>
                    <th scope="col">Acertos</th>
                    <th scope="col">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((linha) => (
                    <tr key={linha.id}>
                      <td className={estilos.destaqueTabela}>{ordinal(linha.posicao)}</td>
                      <td>{linha.apelido}</td>
                      <td>
                        {linha.acertos}/{partida.total_perguntas}
                      </td>
                      <td className={estilos.destaqueTabela}>{formatarPontos(linha.pontos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {erro && (
          <p className={estilos.erroFinal} role="alert">
            {erro}
          </p>
        )}
        <div className={estilos.acoesDireita}>
          <Link to="/adm/quiz" className={estilos.botaoContornoBranco}>
            Voltar ao início
          </Link>
          {partida.quiz_id && (
            <button type="button" className={estilos.botaoGradiente} onClick={jogarNovamente} disabled={abrindo}>
              {abrindo ? 'Abrindo sala…' : 'Jogar novamente'}
            </button>
          )}
        </div>
      </div>
    </FundoPartida>
  )
}

function TelaCancelada() {
  return (
    <FundoPartida>
      <div className={estilos.centro}>
        <h1 className={estilos.tituloConcluida}>Sala cancelada</h1>
        <p className={estilos.mensagem}>Esta sala foi fechada antes de o jogo começar.</p>
        <Link to="/adm/quiz" className={estilos.botaoContornoBranco}>
          Voltar para Meus jogos
        </Link>
      </div>
    </FundoPartida>
  )
}

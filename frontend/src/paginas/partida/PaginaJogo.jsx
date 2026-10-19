import { useCallback, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Carregando from '../../componentes/estados/Carregando'
import {
  IconeAmpulheta,
  IconeCapelo,
  IconeCertoCirculo,
  IconeGrupo,
  IconeHistorico,
  IconeNaSala,
  IconeSairDaSala,
  IconeXisCirculo,
} from '../../componentes/icones/Icones'
import { enderecoDaPartida, esquecerParticipacao, lerParticipacao } from '../../servicos/partidas'
import { paginaInicialDoPerfil, useSessao } from '../../sessao/contexto'
import { Alternativa, FundoPartida, MarcaPartida, Podio, Variacao } from './Partida'
import estilos from './PaginaJogo.module.css'
import { usePartidaAoVivo, useTempoRestante } from './usePartidaAoVivo'
import { formatarPontos, ordinal } from './visual'

/** Tela do estudante durante a partida (no celular ou no computador). */
export default function PaginaJogo() {
  const { pin } = useParams()
  const participacao = lerParticipacao(pin)
  if (!participacao) return <Navigate to={`/entrar-pin?pin=${pin}`} replace />
  return <Jogo pin={pin} chave={participacao.chave} />
}

function Jogo({ pin, chave }) {
  const obterEndereco = useCallback(async () => enderecoDaPartida(pin, { chave }), [pin, chave])
  const { estado, conexao, aviso, enviar, desvio } = usePartidaAoVivo(obterEndereco)
  const [escolha, setEscolha] = useState(null) // { numero, letra } enquanto o servidor não confirma

  if (estado?.tipo === 'removido') return <TelaSaiu titulo="Você foi removido da sala" />
  if (!estado) {
    if (conexao === 'encerrada') return <TelaSaiu titulo="Não foi possível entrar na partida" texto={aviso} />
    return (
      <FundoPartida>
        <div className={estilos.centro}>
          <Carregando texto="Entrando na sala…" />
        </div>
      </FundoPartida>
    )
  }

  const { partida } = estado
  const responder = (letra) => {
    if (enviar('responder', { letra })) setEscolha({ numero: partida.numero, letra })
  }
  const jaEscolheu = escolha?.numero === partida.numero || Boolean(estado.resposta)

  let tela
  if (partida.estado === 'sala') tela = <TelaAguardando estado={estado} enviar={enviar} />
  else if (partida.estado === 'pergunta' && !jaEscolheu)
    tela = <TelaResponder estado={estado} desvio={desvio} aoResponder={responder} />
  else if (partida.estado === 'pergunta') tela = <TelaRespondido estado={estado} desvio={desvio} />
  else if (partida.estado === 'resultado') tela = <TelaFeedback estado={estado} />
  else if (partida.estado === 'ranking') tela = <TelaRankingParcial estado={estado} />
  else if (partida.estado === 'encerrada') tela = <TelaFim estado={estado} />
  else tela = <TelaSaiu titulo="A sala foi fechada" texto="O professor encerrou a sala antes de o jogo começar." />

  return (
    <>
      {conexao === 'reconectando' && (
        <p className={estilos.faixa} role="status">
          Conexão perdida. Reconectando…
        </p>
      )}
      {aviso && conexao !== 'encerrada' && (
        <p className={`${estilos.faixa} ${estilos.faixaErro}`} role="alert">
          {aviso}
        </p>
      )}
      {tela}
    </>
  )
}

function TelaSaiu({ titulo, texto }) {
  const { usuario } = useSessao()
  return (
    <FundoPartida>
      <div className={estilos.centro}>
        <h1 className={estilos.tituloCentral}>{titulo}</h1>
        {texto && <p className={estilos.textoCentral}>{texto}</p>}
        <Link to="/entrar-pin" className={estilos.botaoGradiente} onClick={esquecerParticipacao}>
          Entrar em outra sala
        </Link>
        {usuario && (
          <Link to={paginaInicialDoPerfil(usuario)} className={estilos.linkClaro}>
            Voltar ao início
          </Link>
        )}
      </div>
    </FundoPartida>
  )
}

// ----- sala de espera ----------------------------------------------------------------------------

function TelaAguardando({ estado, enviar }) {
  const { partida } = estado
  return (
    <FundoPartida>
      <div className={estilos.pagina}>
        <header className={estilos.topo}>
          <MarcaPartida subtitulo={null} />
          <p className={estilos.tituloTopo}>{partida.titulo}</p>
        </header>
        <main className={estilos.aguardando}>
          <IconeNaSala className={estilos.iconeNaSala} aria-hidden="true" />
          <p className={estilos.naSala}>Você está na sala!</p>
          <section className={estilos.cartaoQuiz}>
            <p className={estilos.rotuloQuiz}>Quiz</p>
            <h1>{partida.titulo}</h1>
            <div className={estilos.infosQuiz}>
              <div>
                <IconeCapelo aria-hidden="true" />
                <span>Responsável</span>
                <strong>Prof. {partida.professor}</strong>
              </div>
              <div>
                <IconeGrupo aria-hidden="true" />
                <span>Participantes</span>
                <strong>
                  {partida.participantes} {partida.participantes === 1 ? 'jogador' : 'jogadores'}
                </strong>
              </div>
            </div>
          </section>
          <div className={estilos.pontinhos} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className={estilos.esperando}>Aguardando o professor iniciar...</p>
          <p className={estilos.dicaEspera}>Você verá as perguntas na tela a seguir</p>
          <button
            type="button"
            className={estilos.botaoSair}
            onClick={() => {
              enviar('sair')
              esquecerParticipacao()
            }}
          >
            <IconeSairDaSala /> Sair da sala
          </button>
        </main>
      </div>
    </FundoPartida>
  )
}

// ----- pergunta ----------------------------------------------------------------------------------

function TelaResponder({ estado, desvio, aoResponder }) {
  const { partida, pergunta, voce } = estado
  const restante = useTempoRestante(pergunta.prazo, desvio)
  return (
    <div className={estilos.telaClara}>
      <div className={estilos.paginaClara}>
        <header className={estilos.topoPergunta}>
          <div className={estilos.progresso}>
            <span>
              Pergunta {partida.numero} de {partida.total_perguntas}
            </span>
            <div className={estilos.trilho}>
              <span style={{ width: `${(partida.numero / partida.total_perguntas) * 100}%` }} />
            </div>
          </div>
          <div className={estilos.placar}>
            <div className={estilos.pontosAtuais}>
              <span>Pontos</span>
              <strong>{formatarPontos(voce.pontos)}</strong>
            </div>
            <span className={estilos.relogio} role="timer" aria-label={`${restante} segundos restantes`}>
              {restante}
            </span>
          </div>
        </header>
        <div className={estilos.cartaoPergunta}>
          {pergunta.imagem && <img src={pergunta.imagem} alt="" />}
          <h1>{pergunta.texto}</h1>
        </div>
        <div className={estilos.alternativas}>
          {pergunta.alternativas.map((alt, posicao) => (
            <Alternativa
              key={alt.letra}
              posicao={posicao}
              texto={alt.texto}
              grande
              aoEscolher={() => aoResponder(alt.letra)}
              rotulo={`Responder: ${alt.texto}`}
            />
          ))}
        </div>
        <p className={estilos.dicaResponder}>Toque em uma alternativa para responder.</p>
      </div>
    </div>
  )
}

function BarraTempo({ prazo, tempo, desvio }) {
  const restante = useTempoRestante(prazo, desvio)
  return (
    <div className={estilos.barraTempo} aria-hidden="true">
      <span style={{ width: `${Math.min((restante / tempo) * 100, 100)}%` }} />
    </div>
  )
}

function TelaRespondido({ estado, desvio }) {
  const { partida, pergunta } = estado
  return (
    <div className={estilos.telaAzul}>
      <div className={estilos.centro}>
        <span className={estilos.circuloBranco}>
          <IconeAmpulheta className={estilos.ampulheta} aria-hidden="true" />
        </span>
        <p className={estilos.numeroPergunta}>
          Pergunta {partida.numero} de {partida.total_perguntas}
        </p>
        <p className={estilos.textoClaro} role="status">
          Resposta enviada! Aguarde os outros jogadores.
        </p>
      </div>
      <BarraTempo prazo={pergunta.prazo} tempo={pergunta.tempo} desvio={desvio} />
    </div>
  )
}

// ----- resultado da pergunta ---------------------------------------------------------------------

function TelaFeedback({ estado }) {
  const { feedback, voce } = estado
  const acertou = feedback.correta
  const titulo = acertou ? 'Correta' : feedback.respondeu ? 'Incorreta' : 'Tempo esgotado'
  let mensagem
  if (!acertou) mensagem = `A resposta correta era ${feedback.resposta_correta}`
  else if (voce.posicao && voce.posicao <= 3) mensagem = 'Você está no pódio!'
  else mensagem = `Você está em ${ordinal(voce.posicao)} lugar`
  const ganho = feedback.pontos + feedback.bonus

  return (
    <div className={`${estilos.telaFeedback} ${acertou ? estilos.feedbackCerto : estilos.feedbackErrado}`}>
      <div className={estilos.centro} role="status">
        <h1 className={estilos.tituloFeedback}>{titulo}</h1>
        <span className={estilos.circuloBrancoMenor}>
          {acertou ? (
            <IconeCertoCirculo className={estilos.iconeCerto} aria-hidden="true" />
          ) : (
            <IconeXisCirculo className={estilos.iconeErrado} aria-hidden="true" />
          )}
        </span>
        <p className={estilos.mensagemFeedback}>{mensagem}</p>
        <p className={estilos.ganho}>+ {formatarPontos(ganho)}</p>
        {feedback.bonus > 0 && (
          <p className={estilos.bonus}>
            inclui +{formatarPontos(feedback.bonus)} de sequência ({voce.sequencia} acertos seguidos)
          </p>
        )}
      </div>
    </div>
  )
}

// ----- ranking parcial ---------------------------------------------------------------------------

const textoSequencia = (n) => (n === 1 ? '1 acerto seguido' : `${n} acertos seguidos`)

function TelaRankingParcial({ estado }) {
  const { ranking, voce } = estado
  const estouNoTop = ranking.some((linha) => linha.id === voce.id)
  const linhas = estouNoTop
    ? ranking
    : [
        ...ranking,
        { id: voce.id, posicao: voce.posicao, apelido: voce.apelido, pontos: voce.pontos, sequencia: voce.sequencia, variacao: voce.variacao },
      ]
  let mudanca = 'Você manteve a posição.'
  if (voce.variacao > 0) mudanca = `Você subiu ${voce.variacao} ${voce.variacao === 1 ? 'posição' : 'posições'}!`
  if (voce.variacao < 0) mudanca = `Você caiu ${-voce.variacao} ${voce.variacao === -1 ? 'posição' : 'posições'}.`

  return (
    <FundoPartida>
      <div className={estilos.pagina}>
        <header className={estilos.cabecalhoRanking}>
          <p className={estilos.rotuloAmarelo}>Ranking parcial</p>
          <h1>Você está em {ordinal(voce.posicao)}</h1>
          <p className={estilos.mudanca}>{mudanca}</p>
        </header>
        <ol className={estilos.listaRanking}>
          {linhas.map((linha) => {
            const eu = linha.id === voce.id
            const classe = eu
              ? estilos.linhaVoce
              : linha.posicao === 1
                ? estilos.linhaOuro
                : linha.posicao <= 3
                  ? estilos.linhaBranca
                  : estilos.linhaTranslucida
            const comAvatar = eu || linha.posicao <= 3
            return (
              <li key={linha.id} className={`${estilos.linha} ${classe}`} aria-current={eu ? 'true' : undefined}>
                <strong className={estilos.posicao}>{ordinal(linha.posicao)}</strong>
                {comAvatar && (
                  <span className={estilos.avatar} aria-hidden="true">
                    {linha.apelido.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className={estilos.nomeLinha}>
                  <strong>{eu ? 'VOCÊ' : linha.apelido}</strong>
                  {comAvatar && <small>{textoSequencia(linha.sequencia)}</small>}
                </span>
                <strong className={estilos.pontosLinha}>{formatarPontos(linha.pontos)}</strong>
                <Variacao valor={linha.variacao} />
              </li>
            )
          })}
        </ol>
        <p className={estilos.aguardandoProxima}>Aguardando a próxima pergunta...</p>
      </div>
    </FundoPartida>
  )
}

// ----- fim de jogo -------------------------------------------------------------------------------

function TelaFim({ estado }) {
  const { final, ranking } = estado
  const { usuario } = useSessao()
  return (
    <div className={estilos.telaFim}>
      <FundoPartida className={estilos.topoFim}>
        <div className={estilos.cabecalhoFim}>
          <h1>Seu voo terminou!</h1>
          <p>
            Você completou a partida e ficou em {ordinal(final.posicao)} lugar
          </p>
          <div className={estilos.caixaPosicao}>
            <strong>{ordinal(final.posicao)}</strong>
            <span>
              Lugar
              <b>{formatarPontos(final.pontos)} pontos</b>
            </span>
          </div>
        </div>
      </FundoPartida>
      <main className={estilos.corpoFim}>
        <section className={estilos.numerosFim} aria-label="Seu desempenho">
          <div>
            <strong className={estilos.verde}>{final.acertos}</strong>
            <span>Acertos</span>
          </div>
          <div>
            <strong className={estilos.vermelho}>{final.erros}</strong>
            <span>Erros</span>
          </div>
          <div>
            <strong className={estilos.azulClaro}>{final.percentual}%</strong>
            <span>Taxa de acerto</span>
          </div>
          <div>
            <strong className={estilos.laranja}>{final.maior_sequencia}</strong>
            <span>Maior sequência</span>
          </div>
        </section>
        <section aria-labelledby="titulo-podio">
          <h2 id="titulo-podio" className={estilos.tituloPodio}>
            Pódio da partida
          </h2>
          <Podio ranking={ranking} claro />
        </section>
        <div className={estilos.acoesFim}>
          {usuario?.perfil === 'estudante' && (
            <Link to="/historico" className={estilos.botaoLaranja}>
              <IconeHistorico /> Ver histórico
            </Link>
          )}
          <Link
            to={usuario ? paginaInicialDoPerfil(usuario) : '/entrar-pin'}
            className={estilos.botaoContorno}
            onClick={esquecerParticipacao}
          >
            Voltar ao início
          </Link>
        </div>
      </main>
    </div>
  )
}

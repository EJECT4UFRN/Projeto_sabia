import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Carregando from '../../../componentes/estados/Carregando'
import Alerta from '../../../componentes/formulario/Alerta'
import {
  IconeCheckCirculoGrande,
  IconeControle,
  IconeGrupo,
  IconeLivro,
  IconeMais,
  IconeMaisCirculo,
  IconeRaio,
  IconeRelogioVoltar,
  IconeSetaDireita,
  IconeTransmissao,
} from '../../../componentes/icones/Icones'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import { buscarPainel } from '../../../servicos/painel'
import { useSessao } from '../../../sessao/contexto'
import ListaPartidas from './ListaPartidas'
import ModalIniciarSessao from './ModalIniciarSessao'
import estilos from './PaginaDashboard.module.css'

const primeiroNome = (nome) => (nome ?? '').trim().split(/\s+/)[0]

/** Dashboard do professor (mockup "PAINEL ADM - DASHBOARD"). */
export default function PaginaDashboard() {
  const { usuario } = useSessao()
  const [versao, setVersao] = useState(0)
  const [carga, setCarga] = useState({ versao: null, dados: null, erro: '' })
  const [iniciando, setIniciando] = useState(false)

  useEffect(() => {
    let vivo = true
    buscarPainel()
      .then((dados) => vivo && setCarga({ versao, dados, erro: '' }))
      .catch((falha) => vivo && setCarga({ versao, dados: null, erro: falha.message }))
    return () => {
      vivo = false
    }
  }, [versao])

  const carregando = carga.versao !== versao
  const dados = carga.dados
  const numero = (campo) => (dados ? dados[campo] : '–')

  const acoes = (
    <section className={estilos.acoes} aria-labelledby="titulo-acoes">
      <h2 id="titulo-acoes" className={estilos.tituloAcoes}>
        <span className={estilos.raio}>
          <IconeRaio />
        </span>
        Ações rápidas
      </h2>
      <div className={estilos.cartaoAcoes}>
        <Link to="/adm/perguntas/nova" className={`${estilos.acao} ${estilos.acaoLaranja}`}>
          <span className={estilos.iconeAcao}>
            <IconeMais />
          </span>
          <span className={estilos.textosAcao}>
            <span className={estilos.tituloAcao}>Criar nova pergunta</span>
            <span className={estilos.subtituloAcao}>Adicionar ao banco</span>
          </span>
          <IconeSetaDireita className={estilos.setaAcao} />
        </Link>
        <button type="button" className={`${estilos.acao} ${estilos.acaoAmarela}`} onClick={() => setIniciando(true)}>
          <span className={estilos.iconeAcao}>
            <IconeTransmissao />
          </span>
          <span className={estilos.textosAcao}>
            <span className={estilos.tituloAcao}>Iniciar sessão ao vivo</span>
            <span className={estilos.subtituloAcao}>Gerar um PIN de sala</span>
          </span>
          <IconeSetaDireita className={estilos.setaAcao} />
        </button>
      </div>
    </section>
  )

  return (
    <div className={estilos.pagina}>
      <header className={estilos.topo}>
        <div>
          <h1 className={estilos.saudacao}>Olá, {primeiroNome(usuario?.nome) || 'professor'}!</h1>
          <p className={estilos.subtitulo}>Veja o que está acontecendo no Sabiá hoje.</p>
        </div>
        <BotaoPainel para="/adm/quiz/novo" icone={<IconeMaisCirculo />} className={estilos.novoJogo}>
          Novo jogo
        </BotaoPainel>
      </header>

      {carga.erro && !carregando ? (
        <div className={estilos.erro}>
          <Alerta>{carga.erro}</Alerta>
          <BotaoPainel variante="contorno" onClick={() => setVersao((v) => v + 1)}>
            Tentar de novo
          </BotaoPainel>
        </div>
      ) : (
        <section className={estilos.numeros} aria-label="Resumo" aria-busy={carregando}>
          <article className={estilos.numero}>
            <span className={`${estilos.iconeNumero} ${estilos.fundoAzul}`}>
              <IconeLivro />
            </span>
            <strong className={`${estilos.valor} ${estilos.corAzul}`}>{numero('perguntas_total')}</strong>
            <span className={estilos.rotulo}>Total de perguntas</span>
          </article>
          <article className={estilos.numero}>
            <span className={`${estilos.iconeNumero} ${estilos.fundoAmarelo}`}>
              <IconeControle />
            </span>
            <span className={estilos.selo}>Ao vivo</span>
            <strong className={`${estilos.valor} ${estilos.corLaranja}`}>{numero('jogos_ativos')}</strong>
            <span className={estilos.rotulo}>Jogos ativos</span>
          </article>
          <article className={estilos.numero}>
            <span className={`${estilos.iconeNumero} ${estilos.fundoAmarelo}`}>
              <IconeGrupo width="30" height="35" />
            </span>
            {dados?.aguardando > 0 && <span className={estilos.ponto} aria-hidden="true" />}
            <strong className={`${estilos.valor} ${estilos.corAmarela}`}>{numero('aguardando')}</strong>
            <span className={estilos.rotulo}>Aguardando</span>
          </article>
          <article className={estilos.numero}>
            <span className={`${estilos.iconeNumero} ${estilos.fundoClaro}`}>
              <IconeCheckCirculoGrande />
            </span>
            <span className={`${estilos.selo} ${estilos.seloTotal}`}>Total</span>
            <strong className={`${estilos.valor} ${estilos.corAzulClara}`}>{numero('concluidos')}</strong>
            <span className={estilos.rotulo}>Concluídos</span>
          </article>
        </section>
      )}

      <div className={estilos.grade}>
        {acoes}
        <section className={estilos.recentes} aria-labelledby="titulo-recentes">
          <h2 id="titulo-recentes" className={estilos.tituloRecentes}>
            <IconeRelogioVoltar />
            Jogos recentes
          </h2>
          {carregando && !dados ? (
            <Carregando texto="Carregando jogos…" />
          ) : dados && dados.recentes.length === 0 ? (
            <div className={estilos.vazio}>
              <p className={estilos.vazioTitulo}>Nenhuma partida ainda</p>
              <p className={estilos.vazioTexto}>Abra uma sala com um quiz publicado e os jogos aparecem aqui.</p>
              <BotaoPainel variante="escuro" onClick={() => setIniciando(true)}>
                Iniciar sessão ao vivo
              </BotaoPainel>
            </div>
          ) : dados ? (
            <>
              <ListaPartidas partidas={dados.recentes} rotulo="Jogos recentes" />
              <Link to="/adm/partidas" className={estilos.verMais}>
                Ver mais
              </Link>
            </>
          ) : null}
        </section>
      </div>

      <ModalIniciarSessao aberto={iniciando} aoFechar={() => setIniciando(false)} />
    </div>
  )
}

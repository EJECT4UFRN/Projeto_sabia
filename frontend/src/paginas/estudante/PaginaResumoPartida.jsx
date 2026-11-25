import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Carregando from '../../componentes/estados/Carregando'
import Alerta from '../../componentes/formulario/Alerta'
import { IconeCorreto, IconeFechar, IconePinPequeno } from '../../componentes/icones/Icones'
import { buscarResumoPartida } from '../../servicos/historico'
import { formatarPin, formatarPontos, formatarSegundos } from '../partida/visual'
import estilos from './PaginaResumoPartida.module.css'

/** Resumo de uma partida encerrada do histórico (tela criada no estilo do Sabiá; não há no mockup). */
export default function PaginaResumoPartida() {
  const { id } = useParams()
  const [carga, setCarga] = useState({ id: null, dados: null, falha: null })

  useEffect(() => {
    let ativo = true
    buscarResumoPartida(id)
      .then((dados) => ativo && setCarga({ id, dados, falha: null }))
      .catch((falha) => ativo && setCarga({ id, dados: null, falha }))
    return () => {
      ativo = false
    }
  }, [id])

  if (carga.id !== id) return <Carregando texto="Carregando partida…" />
  if (carga.falha?.status === 409) return <Navigate to="/historico" replace />
  if (carga.falha) {
    return (
      <section className={estilos.pagina}>
        <Link to="/historico" className={estilos.voltar}>
          ← Meu histórico
        </Link>
        <Alerta>{carga.falha.message}</Alerta>
      </section>
    )
  }

  const p = carga.dados
  return (
    <section className={estilos.pagina}>
      <Link to="/historico" className={estilos.voltar}>
        ← Meu histórico
      </Link>
      <header className={estilos.cabecalho}>
        <p className={estilos.sobretitulo}>Resumo da partida</p>
        <h1>{p.titulo}</h1>
        <p className={estilos.meta}>
          <span>
            <IconePinPequeno aria-hidden="true" /> {formatarPin(p.pin)}
          </span>
          <span>{new Date(p.data).toLocaleDateString('pt-BR')}</span>
          <span>Prof. {p.professor}</span>
        </p>
      </header>

      <dl className={estilos.numeros}>
        <div className={estilos.destaque}>
          <dt>de {p.participantes} {p.participantes === 1 ? 'jogador' : 'jogadores'}</dt>
          <dd>{p.posicao}º</dd>
        </div>
        <div>
          <dt>Pontos</dt>
          <dd>{formatarPontos(p.pontos)}</dd>
        </div>
        <div>
          <dt>Acertos · {p.percentual}%</dt>
          <dd className={estilos.verde}>
            {p.acertos}/{p.total_perguntas}
          </dd>
        </div>
        <div>
          <dt>Maior sequência</dt>
          <dd className={estilos.laranja}>{p.maior_sequencia}</dd>
        </div>
      </dl>

      <h2 className={estilos.sobretitulo}>Perguntas</h2>
      <ol className={estilos.perguntas}>
        {p.perguntas.map((q) => (
          <li key={q.numero} className={q.acertou ? estilos.acerto : estilos.erro}>
            <span className={estilos.marca} aria-label={q.acertou ? 'Acertou' : 'Errou'} role="img">
              {q.acertou ? <IconeCorreto aria-hidden="true" /> : <IconeFechar aria-hidden="true" />}
            </span>
            <div className={estilos.textoPergunta}>
              <strong>
                {q.numero}. {q.texto}
              </strong>
              <span>
                Sua resposta: <b>{q.sua_resposta ?? 'sem resposta'}</b>
                {!q.acertou && (
                  <>
                    {' · '}Correta: <b>{q.resposta_correta}</b>
                  </>
                )}
              </span>
            </div>
            <span className={estilos.pontosPergunta}>
              +{formatarPontos(q.pontos)}
              {q.tempo !== null && <small>{formatarSegundos(q.tempo)}</small>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Carregando from '../../componentes/estados/Carregando'
import Alerta from '../../componentes/formulario/Alerta'
import { IconePlay } from '../../componentes/icones/Icones'
import BotaoPainel from '../../componentes/painel/BotaoPainel'
import CabecalhoPagina from '../../componentes/painel/CabecalhoPagina'
import { abrirSala } from '../../servicos/partidas'
import { buscarQuiz } from '../../servicos/quizzes'
import estilos from './PaginaAbrirSala.module.css'

const LIMITE = { min: 1, max: 500, padrao: 50 }

/** Passo antes do telão: o professor confere o quiz e escolhe o limite de participantes. */
export default function PaginaAbrirSala() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [carga, setCarga] = useState({ id: null, quiz: null, erro: '' })
  const [limite, setLimite] = useState(String(LIMITE.padrao))
  const [erro, setErro] = useState('')
  const [abrindo, setAbrindo] = useState(false)

  useEffect(() => {
    let ativo = true
    buscarQuiz(id)
      .then((quiz) => ativo && setCarga({ id, quiz, erro: '' }))
      .catch((falha) => ativo && setCarga({ id, quiz: null, erro: falha.message }))
    return () => {
      ativo = false
    }
  }, [id])

  async function abrir(evento) {
    evento.preventDefault()
    const numero = Number(limite)
    if (!Number.isInteger(numero) || numero < LIMITE.min || numero > LIMITE.max) {
      setErro(`Use um número entre ${LIMITE.min} e ${LIMITE.max}.`)
      return
    }
    setAbrindo(true)
    setErro('')
    try {
      const partida = await abrirSala(Number(id), numero)
      navegar(`/adm/partidas/${partida.id}`)
    } catch (falha) {
      setErro(falha.doCampo?.('limite_participantes') ?? falha.doCampo?.('quiz') ?? falha.message)
      setAbrindo(false)
    }
  }

  if (carga.id !== id) return <Carregando texto="Carregando quiz…" />
  const { quiz } = carga

  return (
    <>
      <CabecalhoPagina sobretitulo="Partida ao vivo" titulo="Abrir sala" />
      {carga.erro ? (
        <Alerta>{carga.erro}</Alerta>
      ) : (
        <form className={estilos.cartao} onSubmit={abrir} noValidate>
          <div>
            <p className={estilos.rotulo}>Quiz</p>
            <h2 className={estilos.titulo}>{quiz.titulo}</h2>
            <p className={estilos.detalhe}>
              {quiz.disciplina || 'Sem disciplina'} · {quiz.perguntas_total}{' '}
              {quiz.perguntas_total === 1 ? 'pergunta' : 'perguntas'}
              {quiz.turma && ` · ${quiz.turma}`}
            </p>
          </div>

          {quiz.pode_iniciar ? (
            <>
              <div className={estilos.campo}>
                <label htmlFor="limite-participantes" className={estilos.rotuloCampo}>
                  Limite de participantes
                </label>
                <input
                  id="limite-participantes"
                  type="number"
                  min={LIMITE.min}
                  max={LIMITE.max}
                  value={limite}
                  aria-invalid={Boolean(erro)}
                  aria-describedby="dica-limite"
                  onChange={(e) => {
                    setLimite(e.target.value)
                    setErro('')
                  }}
                />
                <span id="dica-limite" className={estilos.dica}>
                  Quando a sala lotar, ninguém mais entra. Você pode tirar alguém da sala antes de começar.
                </span>
              </div>
              <Alerta>{erro}</Alerta>
              <div className={estilos.acoes}>
                <BotaoPainel variante="contorno" para={`/adm/quiz/${quiz.id}/editar`}>
                  Voltar ao quiz
                </BotaoPainel>
                <BotaoPainel type="submit" icone={<IconePlay />} disabled={abrindo}>
                  {abrindo ? 'Abrindo…' : 'Abrir sala'}
                </BotaoPainel>
              </div>
            </>
          ) : (
            <div className={estilos.aviso}>
              <Alerta>Publique o quiz (com ao menos uma pergunta) para iniciar uma partida.</Alerta>
              <Link to={`/adm/quiz/${quiz.id}/editar`} className={estilos.link}>
                Ir para o editor do quiz
              </Link>
            </div>
          )}
        </form>
      )}
    </>
  )
}

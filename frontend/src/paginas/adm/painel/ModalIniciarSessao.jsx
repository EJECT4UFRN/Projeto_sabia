import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alerta from '../../../componentes/formulario/Alerta'
import Modal from '../../../componentes/painel/Modal'
import { listarQuizzes } from '../../../servicos/quizzes'
import estilos from './PaginaDashboard.module.css'

/** "Iniciar sessão ao vivo": escolhe um quiz publicado e vai para a tela de abrir a sala. */
export default function ModalIniciarSessao({ aberto, aoFechar }) {
  const navegar = useNavigate()
  const [carga, setCarga] = useState({ pronta: false, quizzes: [], erro: '' })

  useEffect(() => {
    if (!aberto) return undefined
    let vivo = true
    listarQuizzes({ status: 'publicado', por_pagina: 50 })
      .then((dados) => {
        if (!vivo) return
        const prontos = dados.results.filter((quiz) => quiz.perguntas_total > 0)
        setCarga({ pronta: true, quizzes: prontos, erro: '' })
      })
      .catch((falha) => vivo && setCarga({ pronta: true, quizzes: [], erro: falha.message }))
    return () => {
      vivo = false
    }
  }, [aberto])

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      sobretitulo="Sessão ao vivo"
      titulo="Qual quiz vamos jogar?"
      descricao="Escolha um quiz publicado. Na próxima tela você define o limite de jogadores e recebe o PIN."
      largura={560}
    >
      {!carga.pronta ? (
        <p className={estilos.textoModal}>Carregando quizzes…</p>
      ) : carga.erro ? (
        <Alerta>{carga.erro}</Alerta>
      ) : carga.quizzes.length === 0 ? (
        <p className={estilos.textoModal}>
          Você ainda não tem quiz publicado com perguntas. <Link to="/adm/quiz/novo">Crie um quiz</Link> e publique
          para começar.
        </p>
      ) : (
        <ul className={estilos.escolhas}>
          {carga.quizzes.map((quiz) => (
            <li key={quiz.id}>
              <button
                type="button"
                className={estilos.escolha}
                onClick={() => navegar(`/adm/quiz/${quiz.id}/partida`)}
              >
                <span className={estilos.escolhaTitulo}>{quiz.titulo}</span>
                <span className={estilos.escolhaDetalhe}>
                  {[quiz.disciplina, `${quiz.perguntas_total} ${quiz.perguntas_total === 1 ? 'pergunta' : 'perguntas'}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import Alerta from '../../../componentes/formulario/Alerta'
import Modal from '../../../componentes/painel/Modal'
import Avatar from '../../../componentes/usuario/Avatar'
import { listarConclusoes } from '../../../servicos/materiais'
import estilos from './PaginaMateriais.module.css'

/** Lista dos estudantes que marcaram o material como concluído. */
export default function ModalConclusoes({ material, aoFechar }) {
  const [carga, setCarga] = useState({ id: null, alunos: [], erro: '' })

  useEffect(() => {
    if (!material) return undefined
    let vivo = true
    listarConclusoes(material.id)
      .then((alunos) => vivo && setCarga({ id: material.id, alunos, erro: '' }))
      .catch((falha) => vivo && setCarga({ id: material.id, alunos: [], erro: falha.message }))
    return () => {
      vivo = false
    }
  }, [material])

  const carregando = material && carga.id !== material.id

  return (
    <Modal
      aberto={Boolean(material)}
      aoFechar={aoFechar}
      sobretitulo="Concluído"
      titulo={material?.titulo ?? ''}
      descricao="Estudantes que marcaram este material como concluído."
      largura={480}
    >
      {carregando ? (
        <p className={estilos.textoModal}>Carregando…</p>
      ) : carga.erro ? (
        <Alerta>{carga.erro}</Alerta>
      ) : carga.alunos.length === 0 ? (
        <p className={estilos.textoModal}>Ninguém marcou como concluído ainda.</p>
      ) : (
        <ul className={estilos.listaConcluiram}>
          {carga.alunos.map((aluno) => (
            <li key={aluno.id} className={estilos.alunoConcluiu}>
              <Avatar iniciais={aluno.iniciais} cor={aluno.cor_avatar} tamanho={32} />
              <span className={estilos.nomeAluno}>
                {aluno.nome}
                <span>@{aluno.username}</span>
              </span>
              <span className={estilos.dataConclusao}>
                {new Date(aluno.concluido_em).toLocaleDateString('pt-BR')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

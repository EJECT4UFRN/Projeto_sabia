import { useId, useState } from 'react'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import Modal from '../../../componentes/painel/Modal'
import { salvarTurma } from '../../../servicos/escola'
import estilos from './Turmas.module.css'

/** Modal com o nome da turma: cria (sem `turma`) ou renomeia. */
export default function ModalNomeTurma({ aberto, aoFechar, aoSalvar, turma = null }) {
  const idCampo = useId()
  const [nome, setNome] = useState(turma?.nome ?? '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  function fechar() {
    if (salvando) return
    setErro('')
    setNome(turma?.nome ?? '')
    aoFechar()
  }

  async function enviar(evento) {
    evento.preventDefault()
    // O modal pode estar dentro de outro formulário (o do material): o envio não sobe para ele.
    evento.stopPropagation()
    if (!nome.trim()) {
      setErro('Digite o nome da turma.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const salva = await salvarTurma(turma?.id, { nome })
      setSalvando(false)
      aoSalvar(salva)
    } catch (falha) {
      setErro(falha.doCampo?.('nome') ?? falha.message)
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      sobretitulo="Turma"
      titulo={turma ? 'Renomear turma' : 'Nova turma'}
      descricao={turma ? undefined : 'Depois é só adicionar os alunos ou passar o código para eles.'}
      largura={520}
    >
      <form className={estilos.formularioModal} onSubmit={enviar} noValidate>
        <label className={estilos.rotulo} htmlFor={idCampo}>
          Nome da turma *
        </label>
        <input
          id={idCampo}
          className={estilos.entrada}
          maxLength={60}
          placeholder="Ex.: 8º Ano A"
          value={nome}
          aria-invalid={Boolean(erro)}
          aria-describedby={erro ? `${idCampo}-erro` : undefined}
          onChange={(e) => setNome(e.target.value)}
        />
        {erro && (
          <p id={`${idCampo}-erro`} className={estilos.erro}>
            {erro}
          </p>
        )}
        <div className={estilos.botoesModal}>
          <BotaoPainel variante="contornoAzul" onClick={fechar} disabled={salvando}>
            Cancelar
          </BotaoPainel>
          <BotaoPainel variante="gradiente" type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : turma ? 'Salvar nome' : 'Criar turma'}
          </BotaoPainel>
        </div>
      </form>
    </Modal>
  )
}

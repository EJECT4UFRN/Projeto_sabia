import { useId, useState } from 'react'
import { criarDisciplina } from '../../servicos/escola'
import BotaoPainel from './BotaoPainel'
import Modal from './Modal'
import estilos from './ModalDisciplina.module.css'

/** Modal "Cadastrar disciplina" (mockup): um campo só, e a nova disciplina já volta escolhida. */
export default function ModalDisciplina({
  aberto,
  aoFechar,
  aoCriar,
  descricao = 'Adicione uma disciplina para utilizar neste material.',
}) {
  const idCampo = useId()
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  function fechar() {
    if (salvando) return
    setNome('')
    setErro('')
    aoFechar()
  }

  async function enviar(evento) {
    evento.preventDefault()
    // O modal pode estar dentro de outro formulário (o do material): o envio não sobe para ele.
    evento.stopPropagation()
    if (!nome.trim()) {
      setErro('Digite o nome da disciplina.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const nova = await criarDisciplina(nome)
      setNome('')
      aoCriar(nova)
    } catch (falha) {
      setErro(falha.doCampo?.('nome') ?? falha.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={fechar} sobretitulo="Disciplina" titulo="Cadastrar disciplina" descricao={descricao} largura={560}>
      <form className={estilos.formulario} onSubmit={enviar} noValidate>
        <label className={estilos.rotulo} htmlFor={idCampo}>
          Nome da disciplina *
        </label>
        <input
          id={idCampo}
          className={estilos.entrada}
          maxLength={60}
          placeholder="Ex.: Geografia"
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
        <div className={estilos.botoes}>
          <BotaoPainel variante="contornoAzul" onClick={fechar} disabled={salvando}>
            Cancelar
          </BotaoPainel>
          <BotaoPainel variante="gradiente" type="submit" disabled={salvando}>
            {salvando ? 'Cadastrando…' : 'Cadastrar disciplina'}
          </BotaoPainel>
        </div>
      </form>
    </Modal>
  )
}


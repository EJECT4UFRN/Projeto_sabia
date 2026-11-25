import { useState } from 'react'
import ModalDisciplina from './ModalDisciplina'

const NOVA = '__nova__'

/**
 * <select> das disciplinas do professor com a opção "+ Cadastrar disciplina", que abre o
 * modal do mockup. A disciplina criada entra na lista (`aoCadastrar`) e já fica escolhida.
 */
export default function SeletorDisciplina({
  valor,
  aoMudar,
  disciplinas,
  aoCadastrar,
  textoVazio = 'Selecione',
  descricaoModal,
  ...props
}) {
  const [modalAberto, setModalAberto] = useState(false)

  return (
    <>
      <select
        value={valor}
        onChange={(evento) => {
          if (evento.target.value === NOVA) setModalAberto(true)
          else aoMudar(evento.target.value)
        }}
        {...props}
      >
        <option value="">{textoVazio}</option>
        {disciplinas.map((disciplina) => (
          <option key={disciplina.id} value={String(disciplina.id)}>
            {disciplina.nome}
          </option>
        ))}
        <option value={NOVA}>+ Cadastrar disciplina</option>
      </select>
      <ModalDisciplina
        aberto={modalAberto}
        descricao={descricaoModal}
        aoFechar={() => setModalAberto(false)}
        aoCriar={(nova) => {
          setModalAberto(false)
          aoCadastrar(nova)
          aoMudar(String(nova.id))
        }}
      />
    </>
  )
}

import { useEffect, useId, useState } from 'react'
import Alerta from '../../componentes/formulario/Alerta'
import { entrarNaTurma, listarMinhasTurmas, sairDaTurma } from '../../servicos/escola'
import estilosPerfil from './PaginaPerfil.module.css'
import estilos from './CartaoMinhasTurmas.module.css'

/** "Minhas turmas" no perfil do estudante: entrar com o código do professor e sair. */
export default function CartaoMinhasTurmas() {
  const idCodigo = useId()
  const [carga, setCarga] = useState({ pronto: false, turmas: [], erro: '' })
  const [codigo, setCodigo] = useState('')
  const [erroCodigo, setErroCodigo] = useState('')
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' })
  const [enviando, setEnviando] = useState(false)
  const [saindo, setSaindo] = useState(null)

  useEffect(() => {
    let ativo = true
    listarMinhasTurmas()
      .then((turmas) => ativo && setCarga({ pronto: true, turmas, erro: '' }))
      .catch((falha) => ativo && setCarga({ pronto: true, turmas: [], erro: falha.message }))
    return () => {
      ativo = false
    }
  }, [])

  async function entrar(evento) {
    evento.preventDefault()
    if (!codigo.trim()) {
      setErroCodigo('Digite o código da turma.')
      return
    }
    setEnviando(true)
    setErroCodigo('')
    setMensagem({ tipo: '', texto: '' })
    try {
      const turma = await entrarNaTurma(codigo)
      setCarga((atual) => ({ ...atual, turmas: [...atual.turmas, turma] }))
      setCodigo('')
      setMensagem({ tipo: 'sucesso', texto: `Você entrou na turma ${turma.nome}. Os materiais dela já aparecem em Materiais.` })
    } catch (falha) {
      const doCampo = falha.doCampo?.('codigo')
      if (doCampo) setErroCodigo(doCampo)
      else setMensagem({ tipo: 'erro', texto: falha.message })
    } finally {
      setEnviando(false)
    }
  }

  async function sair(turma) {
    setSaindo(turma.id)
    setMensagem({ tipo: '', texto: '' })
    try {
      await sairDaTurma(turma.id)
      setCarga((atual) => ({ ...atual, turmas: atual.turmas.filter((t) => t.id !== turma.id) }))
      setMensagem({ tipo: 'sucesso', texto: `Você saiu da turma ${turma.nome}.` })
    } catch (falha) {
      setMensagem({ tipo: 'erro', texto: falha.message })
    } finally {
      setSaindo(null)
    }
  }

  return (
    <section className={estilosPerfil.cartao} aria-labelledby={`${idCodigo}-titulo`}>
      <h2 id={`${idCodigo}-titulo`} className={estilosPerfil.rotuloSecao}>
        Minhas turmas
      </h2>

      {!carga.pronto ? (
        <p className={estilos.texto}>Carregando turmas…</p>
      ) : carga.erro ? (
        <Alerta>{carga.erro}</Alerta>
      ) : carga.turmas.length === 0 ? (
        <p className={estilos.texto}>Você ainda não está em nenhuma turma.</p>
      ) : (
        <ul className={estilos.lista}>
          {carga.turmas.map((turma) => (
            <li key={turma.id} className={estilos.turma}>
              <span className={estilos.nome}>
                {turma.nome}
                <span className={estilos.professor}>Prof. {turma.professor}</span>
              </span>
              <button
                type="button"
                className={estilos.sair}
                disabled={saindo === turma.id}
                onClick={() => sair(turma)}
              >
                Sair
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className={estilos.formulario} onSubmit={entrar} noValidate>
        <label htmlFor={idCodigo} className={estilosPerfil.rotulo}>
          Código da turma
        </label>
        <div className={estilos.linha}>
          <input
            id={idCodigo}
            className={`${estilosPerfil.entrada} ${estilos.codigo}`}
            maxLength={12}
            autoComplete="off"
            placeholder="Ex.: K7P2QX"
            value={codigo}
            aria-invalid={Boolean(erroCodigo)}
            aria-describedby={erroCodigo ? `${idCodigo}-erro` : `${idCodigo}-ajuda`}
            onChange={(e) => {
              setCodigo(e.target.value.toUpperCase())
              setErroCodigo('')
            }}
          />
          <button type="submit" className={estilosPerfil.botaoSecundario} disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar na turma'}
          </button>
        </div>
        {erroCodigo ? (
          <span id={`${idCodigo}-erro`} className={estilos.erro}>
            {erroCodigo}
          </span>
        ) : (
          <span id={`${idCodigo}-ajuda`} className={estilosPerfil.ajuda}>
            Peça o código ao seu professor. Com ele você vê os materiais da turma.
          </span>
        )}
      </form>
      <Alerta tipo={mensagem.tipo || 'erro'}>{mensagem.texto}</Alerta>
    </section>
  )
}

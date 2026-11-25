import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buscarNoPainel } from '../../servicos/painel'
import { IconeBusca } from '../icones/Icones'
import Avatar from '../usuario/Avatar'
import estilos from './BuscaPainel.module.css'

const ESPERA = 300

/**
 * Busca do cabeçalho do painel: quizzes do professor e alunos das turmas dele, numa lista
 * suspensa. Setas sobem e descem, Enter abre, Esc fecha.
 */
export default function BuscaPainel() {
  const navegar = useNavigate()
  const idLista = useId()
  const caixa = useRef(null)
  const espera = useRef(null)
  const [texto, setTexto] = useState('')
  const [termo, setTermo] = useState('')
  const [aberta, setAberta] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const [resultado, setResultado] = useState({ termo: '', quizzes: [], alunos: [], erro: '' })

  const buscando = termo.length >= 2 && resultado.termo !== termo
  const itens = [
    ...resultado.quizzes.map((quiz) => ({ tipo: 'quiz', chave: `q${quiz.id}`, para: `/adm/quiz/${quiz.id}/editar`, dado: quiz })),
    ...resultado.alunos.map((aluno) => ({ tipo: 'aluno', chave: `a${aluno.id}`, para: `/adm/turmas/${aluno.turma.id}`, dado: aluno })),
  ]
  const mostrar = aberta && texto.trim().length >= 2

  useEffect(() => {
    if (termo.length < 2) return undefined
    let vivo = true
    buscarNoPainel(termo)
      .then((dados) => vivo && setResultado({ termo, ...dados, erro: '' }))
      .catch((falha) => vivo && setResultado({ termo, quizzes: [], alunos: [], erro: falha.message }))
    return () => {
      vivo = false
    }
  }, [termo])

  useEffect(() => {
    if (!aberta) return undefined
    function aoClicarFora(evento) {
      if (caixa.current && !caixa.current.contains(evento.target)) setAberta(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberta])

  useEffect(() => () => clearTimeout(espera.current), [])

  function digitar(valor) {
    setTexto(valor)
    setAberta(true)
    setAtivo(0)
    clearTimeout(espera.current)
    espera.current = setTimeout(() => setTermo(valor.trim()), ESPERA)
  }

  function abrir(item) {
    setAberta(false)
    setTexto('')
    setTermo('')
    navegar(item.para)
  }

  function teclar(evento) {
    if (evento.key === 'Escape') setAberta(false)
    if (!mostrar || itens.length === 0) return
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAtivo((i) => (i + 1) % itens.length)
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setAtivo((i) => (i - 1 + itens.length) % itens.length)
    } else if (evento.key === 'Enter') {
      evento.preventDefault()
      abrir(itens[Math.min(ativo, itens.length - 1)])
    }
  }

  const grupo = (tipo, titulo) => {
    const doTipo = itens.filter((item) => item.tipo === tipo)
    if (doTipo.length === 0) return null
    return (
      <li role="presentation">
        <p className={estilos.grupo}>{titulo}</p>
        <ul role="presentation" className={estilos.itens}>
          {doTipo.map((item) => {
            const indice = itens.indexOf(item)
            return (
              <li
                key={item.chave}
                id={`${idLista}-${item.chave}`}
                role="option"
                aria-selected={indice === ativo}
                className={`${estilos.item} ${indice === ativo ? estilos.ativo : ''}`}
                onMouseEnter={() => setAtivo(indice)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  abrir(item)
                }}
              >
                {item.tipo === 'quiz' ? (
                  <>
                    <span className={estilos.marcaQuiz}>Quiz</span>
                    <span className={estilos.textos}>
                      <span className={estilos.principal}>{item.dado.titulo}</span>
                      <span className={estilos.detalhe}>
                        {[item.dado.disciplina, item.dado.status === 'publicado' ? 'Publicado' : 'Rascunho']
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <Avatar iniciais={item.dado.iniciais} cor={item.dado.cor_avatar} tamanho={32} />
                    <span className={estilos.textos}>
                      <span className={estilos.principal}>{item.dado.nome}</span>
                      <span className={estilos.detalhe}>{item.dado.turma.nome}</span>
                    </span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </li>
    )
  }

  return (
    <div className={estilos.caixa} ref={caixa}>
      <label className={estilos.campo}>
        <IconeBusca />
        <span className="visualmente-oculto">Buscar quizzes ou jogadores</span>
        <input
          type="search"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={mostrar && itens[ativo] ? `${idLista}-${itens[ativo].chave}` : undefined}
          placeholder="Buscar quizzes ou jogadores..."
          value={texto}
          onChange={(e) => digitar(e.target.value)}
          onFocus={() => setAberta(true)}
          onKeyDown={teclar}
        />
      </label>
      {mostrar && (
        <ul id={idLista} role="listbox" aria-label="Resultados da busca" className={estilos.lista}>
          {buscando ? (
            <li role="presentation" className={estilos.aviso}>
              Buscando…
            </li>
          ) : resultado.erro ? (
            <li role="presentation" className={estilos.aviso}>
              {resultado.erro}
            </li>
          ) : itens.length === 0 ? (
            <li role="presentation" className={estilos.aviso}>
              Nada encontrado para “{termo}”.
            </li>
          ) : (
            <>
              {grupo('quiz', 'Quizzes')}
              {grupo('aluno', 'Alunos das suas turmas')}
            </>
          )}
        </ul>
      )}
    </div>
  )
}

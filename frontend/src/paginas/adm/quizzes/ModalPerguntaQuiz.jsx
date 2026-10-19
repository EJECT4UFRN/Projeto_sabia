import { useId, useState } from 'react'
import Alerta from '../../../componentes/formulario/Alerta'
import { IconeImagem } from '../../../componentes/icones/Icones'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import Modal from '../../../componentes/painel/Modal'
import { LETRAS, LIMITES, validarPergunta } from '../perguntas/validacaoPergunta'
import estilos from './ModalPerguntaQuiz.module.css'

const CAMPOS = ['texto', 'alternativa_a', 'alternativa_b', 'alternativa_c', 'alternativa_d', 'resposta_correta']

function paraFormulario(pergunta, padroes) {
  if (!pergunta) {
    return {
      texto: '',
      alternativa_a: '',
      alternativa_b: '',
      alternativa_c: '',
      alternativa_d: '',
      resposta_correta: '',
      tempo_limite: String(padroes.tempo),
      pontuacao_maxima: String(padroes.pontuacao),
    }
  }
  return {
    ...Object.fromEntries(CAMPOS.map((campo) => [campo, pergunta[campo] ?? ''])),
    tempo_limite: String(pergunta.tempo_limite),
    pontuacao_maxima: String(pergunta.pontuacao_maxima),
  }
}

/**
 * "Nova pergunta" / "Editar pergunta" dentro do editor de quiz.
 * Quem chama decide para onde vai: pergunta nova vai para o banco; a edição vale só para o quiz.
 * `aoSalvar(dados, { imagem, removerImagem })` deve lançar o ErroApi em caso de falha.
 */
export default function ModalPerguntaQuiz({ pergunta, padroes, aoFechar, aoSalvar }) {
  const editando = Boolean(pergunta)
  const idImagem = useId()
  const [dados, setDados] = useState(() => paraFormulario(pergunta, padroes))
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [imagem, setImagem] = useState(null)
  const [removerImagem, setRemoverImagem] = useState(false)
  const imagemAtual = !removerImagem && !imagem && pergunta?.imagem

  function mudar(campo, valor) {
    setDados((d) => ({ ...d, [campo]: valor }))
    setErros((e) => ({ ...e, [campo]: undefined }))
  }

  async function enviar(evento) {
    evento.preventDefault()
    const encontrados = validarPergunta(dados)
    setErros(encontrados)
    setErroGeral('')
    if (Object.keys(encontrados).length) return

    setEnviando(true)
    try {
      await aoSalvar(
        {
          ...dados,
          tempo_limite: Number(dados.tempo_limite),
          pontuacao_maxima: Number(dados.pontuacao_maxima),
        },
        { imagem, removerImagem: removerImagem && !imagem },
      )
    } catch (falha) {
      const doServidor = {}
      ;[...CAMPOS, 'tempo_limite', 'pontuacao_maxima', 'imagem'].forEach((campo) => {
        const mensagem = falha.doCampo?.(campo)
        if (mensagem) doServidor[campo] = mensagem
      })
      setErros(doServidor)
      setErroGeral(Object.keys(doServidor).length ? 'Confira os campos destacados.' : falha.message)
      setEnviando(false)
    }
  }

  const erroDe = (campo) =>
    erros[campo] && (
      <span className={estilos.erro} id={`erro-${campo}`}>
        {erros[campo]}
      </span>
    )

  return (
    <Modal
      aberto
      aoFechar={() => !enviando && aoFechar()}
      sobretitulo="Pergunta do quiz"
      titulo={editando ? 'Editar pergunta' : 'Nova pergunta'}
      descricao={
        editando
          ? 'As mudanças valem só para este quiz; o banco de perguntas não muda.'
          : 'Crie uma pergunta para adicionar a este quiz. Ela também fica salva no seu banco.'
      }
      largura={844}
    >
      <form className={estilos.formulario} onSubmit={enviar} noValidate>
        <label className={estilos.campo}>
          <span className={estilos.rotulo}>Texto da pergunta *</span>
          <textarea
            className={estilos.entrada}
            rows={3}
            maxLength={300}
            placeholder="Digite a pergunta"
            value={dados.texto}
            aria-invalid={Boolean(erros.texto)}
            onChange={(e) => mudar('texto', e.target.value)}
          />
          {erroDe('texto')}
        </label>

        <fieldset className={estilos.grupo}>
          <legend className={estilos.rotulo}>Alternativas *</legend>
          <div className={estilos.grade}>
            {LETRAS.map((letra) => {
              const campo = `alternativa_${letra}`
              return (
                <label key={letra} className={estilos.campo}>
                  <span className={estilos.rotuloMenor}>Resposta {letra.toUpperCase()} *</span>
                  <input
                    className={estilos.entrada}
                    maxLength={150}
                    value={dados[campo]}
                    aria-invalid={Boolean(erros[campo])}
                    onChange={(e) => mudar(campo, e.target.value)}
                  />
                  {erroDe(campo)}
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset className={estilos.grupo}>
          <legend className={estilos.rotulo}>Resposta correta *</legend>
          <div className={estilos.letras} role="radiogroup" aria-label="Resposta correta">
            {LETRAS.map((letra) => {
              const valor = letra.toUpperCase()
              return (
                <label
                  key={letra}
                  className={`${estilos.letra} ${dados.resposta_correta === valor ? estilos.letraMarcada : ''}`}
                >
                  <input
                    type="radio"
                    name="resposta_correta"
                    value={valor}
                    checked={dados.resposta_correta === valor}
                    onChange={() => mudar('resposta_correta', valor)}
                  />
                  {valor}
                </label>
              )
            })}
          </div>
          {erroDe('resposta_correta')}
        </fieldset>

        <div className={estilos.grade}>
          <label className={estilos.campo}>
            <span className={estilos.rotulo}>Tempo para responder *</span>
            <input
              className={estilos.entrada}
              type="number"
              min={LIMITES.tempo.min}
              max={LIMITES.tempo.max}
              value={dados.tempo_limite}
              aria-invalid={Boolean(erros.tempo_limite)}
              onChange={(e) => mudar('tempo_limite', e.target.value)}
            />
            {erroDe('tempo_limite')}
          </label>
          <label className={estilos.campo}>
            <span className={estilos.rotulo}>Pontuação *</span>
            <input
              className={estilos.entrada}
              type="number"
              min={LIMITES.pontuacao.min}
              max={LIMITES.pontuacao.max}
              step={100}
              value={dados.pontuacao_maxima}
              aria-invalid={Boolean(erros.pontuacao_maxima)}
              onChange={(e) => mudar('pontuacao_maxima', e.target.value)}
            />
            {erroDe('pontuacao_maxima')}
          </label>
        </div>

        <div className={estilos.campo}>
          <span className={estilos.rotulo}>
            Adicionar imagem <span className={estilos.opcional}>(opcional)</span>
          </span>
          <label htmlFor={idImagem} className={estilos.upload}>
            <IconeImagem />
            <span>
              {imagem?.name ??
                (imagemAtual ? 'Substituir a imagem atual' : 'Selecionar ou substituir imagem')}
            </span>
          </label>
          <input
            id={idImagem}
            className="visualmente-oculto"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-label="Imagem da pergunta"
            onChange={(e) => {
              setImagem(e.target.files?.[0] ?? null)
              setErros((er) => ({ ...er, imagem: undefined }))
            }}
          />
          {(imagem || imagemAtual) && (
            <button
              type="button"
              className={estilos.removerImagem}
              onClick={() => {
                setImagem(null)
                setRemoverImagem(Boolean(pergunta?.imagem))
              }}
            >
              Remover imagem
            </button>
          )}
          {erroDe('imagem')}
        </div>

        <Alerta>{erroGeral}</Alerta>

        <div className={estilos.rodape}>
          <BotaoPainel variante="contorno" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </BotaoPainel>
          <BotaoPainel type="submit" disabled={enviando}>
            {enviando ? 'Salvando…' : editando ? 'Salvar pergunta' : 'Adicionar pergunta'}
          </BotaoPainel>
        </div>
      </form>
    </Modal>
  )
}

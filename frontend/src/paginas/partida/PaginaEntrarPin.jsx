import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import passaroAzul from '../../assets/partida/sabia-azul.svg'
import Alerta from '../../componentes/formulario/Alerta'
import { IconeControle, IconePessoa } from '../../componentes/icones/Icones'
import { entrarNaPartida, guardarParticipacao, lerParticipacao } from '../../servicos/partidas'
import { useSessao } from '../../sessao/contexto'
import estilos from './PaginaEntrarPin.module.css'

const TAMANHO_PIN = 6

function digitosIniciais(pin) {
  const limpos = (pin ?? '').replace(/\D/g, '').slice(0, TAMANHO_PIN).split('')
  return Array.from({ length: TAMANHO_PIN }, (_, i) => limpos[i] ?? '')
}

export default function PaginaEntrarPin() {
  const [parametros] = useSearchParams()
  const { usuario } = useSessao()
  const navegar = useNavigate()
  const [digitos, setDigitos] = useState(() => digitosIniciais(parametros.get('pin')))
  // Enquanto a pessoa não digita, o apelido sugerido é o nome de quem está logado.
  const [apelidoDigitado, setApelidoDigitado] = useState(null)
  const apelido = apelidoDigitado ?? (usuario ? (usuario.nome || usuario.username).slice(0, 30) : '')
  const [erros, setErros] = useState({})
  const [enviando, setEnviando] = useState(false)
  const caixas = useRef([])

  const pin = digitos.join('')
  const participacaoAnterior = pin.length === TAMANHO_PIN ? lerParticipacao(pin) : null

  function preencher(indice, valor) {
    const numeros = valor.replace(/\D/g, '')
    if (!numeros) {
      setDigitos((atuais) => atuais.map((d, i) => (i === indice ? '' : d)))
      return
    }
    // Colar o PIN inteiro (ou digitar rápido) preenche as caixas seguintes.
    setDigitos((atuais) => {
      const novos = [...atuais]
      numeros
        .slice(0, TAMANHO_PIN - indice)
        .split('')
        .forEach((n, deslocamento) => {
          novos[indice + deslocamento] = n
        })
      return novos
    })
    setErros((e) => ({ ...e, pin: undefined }))
    const proxima = Math.min(indice + numeros.length, TAMANHO_PIN - 1)
    caixas.current[proxima]?.focus()
  }

  function teclar(indice, evento) {
    if (evento.key === 'Backspace' && !digitos[indice] && indice > 0) {
      caixas.current[indice - 1]?.focus()
    } else if (evento.key === 'ArrowLeft' && indice > 0) {
      caixas.current[indice - 1]?.focus()
    } else if (evento.key === 'ArrowRight' && indice < TAMANHO_PIN - 1) {
      caixas.current[indice + 1]?.focus()
    }
  }

  async function enviar(evento) {
    evento.preventDefault()
    const encontrados = {}
    if (pin.length !== TAMANHO_PIN) encontrados.pin = 'Digite os 6 números do PIN.'
    if (!apelido.trim()) encontrados.apelido = 'Escolha um apelido para entrar.'
    setErros(encontrados)
    if (Object.keys(encontrados).length) return

    setEnviando(true)
    try {
      const resposta = await entrarNaPartida(pin, apelido.trim())
      guardarParticipacao({ pin, chave: resposta.chave, apelido: resposta.apelido, titulo: resposta.partida.titulo })
      navegar(`/jogo/${pin}`)
    } catch (falha) {
      const doServidor = {}
      ;['pin', 'apelido'].forEach((campo) => {
        const mensagem = falha.doCampo?.(campo)
        if (mensagem) doServidor[campo] = mensagem
      })
      setErros(Object.keys(doServidor).length ? doServidor : { geral: falha.message })
      setEnviando(false)
    }
  }

  return (
    <section className={estilos.pagina}>
      <header className={estilos.cabecalho}>
        <p className={estilos.aoVivo}>
          <span className={estilos.pontoVerde} aria-hidden="true" />
          Partidas ao vivo
        </p>
        <h1 className={estilos.titulo}>
          Entre no jogo.{' '}
          <span>Digite o PIN.</span>
        </h1>
      </header>

      <div className={estilos.areaCartao}>
        <img src={passaroAzul} alt="" className={estilos.passaro} aria-hidden="true" />
        <form className={estilos.cartao} onSubmit={enviar} noValidate>
          <fieldset className={estilos.grupoPin}>
            <legend className={estilos.rotulo}>PIN de 6 dígitos</legend>
            <div className={estilos.caixas}>
              {digitos.map((digito, indice) => (
                <span key={indice} className={estilos.caixaComSeparador}>
                  {indice === 3 && <span className={estilos.separador} aria-hidden="true" />}
                  <input
                    ref={(el) => {
                      caixas.current[indice] = el
                    }}
                    className={estilos.caixa}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label={`Dígito ${indice + 1} do PIN`}
                    aria-invalid={Boolean(erros.pin)}
                    value={digito}
                    onChange={(e) => preencher(indice, e.target.value)}
                    onKeyDown={(e) => teclar(indice, e)}
                    onFocus={(e) => e.target.select()}
                  />
                </span>
              ))}
            </div>
            {erros.pin && <span className={estilos.erro}>{erros.pin}</span>}
          </fieldset>

          <div className={estilos.campoApelido}>
            <label htmlFor="apelido-partida" className={estilos.rotulo}>
              Seu apelido
            </label>
            <input
              id="apelido-partida"
              className={estilos.entrada}
              maxLength={30}
              placeholder="Como você quer aparecer no ranking"
              value={apelido}
              aria-invalid={Boolean(erros.apelido)}
              onChange={(e) => {
                setApelidoDigitado(e.target.value)
                setErros((er) => ({ ...er, apelido: undefined }))
              }}
            />
            {erros.apelido && <span className={estilos.erro}>{erros.apelido}</span>}
          </div>

          <Alerta>{erros.geral}</Alerta>

          {participacaoAnterior && (
            <p className={estilos.retomar}>
              Você já está nesta sala como <strong>{participacaoAnterior.apelido}</strong>.{' '}
              <Link to={`/jogo/${pin}`}>Voltar para a partida</Link>
            </p>
          )}

          <button type="submit" className={estilos.botaoEntrar} disabled={enviando}>
            <IconeControle /> {enviando ? 'Entrando…' : 'Entrar no jogo'}
          </button>
        </form>
      </div>

      {!usuario && (
        <Link to="/entrar" className={estilos.entrarConta}>
          <IconePessoa /> Entrar na minha conta
        </Link>
      )}
    </section>
  )
}

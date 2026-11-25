import fundo from '../../assets/partida/fundo-partida.svg'
import { IconeDesceu, IconeManteve, IconeMedalha, IconeSubiu } from '../../componentes/icones/Icones'
import Logo from '../../componentes/marca/Logo'
import estilos from './Partida.module.css'
import { VISUAL_ALTERNATIVAS } from './visual'

/** Fundo azul das telas da partida, com as formas desfocadas do mockup. */
export function FundoPartida({ children, className = '', semFormas = false }) {
  return (
    <div className={`${estilos.fundo} ${className}`}>
      {!semFormas && <img src={fundo} alt="" className={estilos.formas} aria-hidden="true" />}
      <div className={estilos.desfoque} aria-hidden="true" />
      <div className={estilos.conteudo}>{children}</div>
    </div>
  )
}

export function MarcaPartida({ subtitulo = 'PAINEL ADMINISTRATIVO' }) {
  return <Logo variante="laranja" posicao="lado" largura={83} corTexto="branco" subtitulo={subtitulo} />
}

/** Uma alternativa colorida. Vira botão quando recebe `aoEscolher`. */
export function Alternativa({ posicao, texto, aoEscolher, destaque, apagada, rotulo, children, grande }) {
  const { classe, Icone, nome } = VISUAL_ALTERNATIVAS[posicao]
  const classes = [
    estilos.alternativa,
    estilos[classe],
    grande ? estilos.alternativaGrande : '',
    destaque ? estilos.alternativaCorreta : '',
    apagada ? estilos.alternativaApagada : '',
  ].join(' ')
  const conteudo = (
    <>
      <Icone className={estilos.simbolo} aria-hidden="true" />
      <span className={estilos.textoAlternativa}>{texto}</span>
      {children}
    </>
  )
  if (aoEscolher) {
    return (
      <button type="button" className={classes} onClick={aoEscolher} aria-label={rotulo ?? `${nome}: ${texto}`}>
        {conteudo}
      </button>
    )
  }
  return <div className={classes}>{conteudo}</div>
}

export function Variacao({ valor }) {
  if (valor > 0)
    return <IconeSubiu className={`${estilos.variacao} ${estilos.subiu}`} role="img" aria-hidden={false} aria-label="Subiu" />
  if (valor < 0)
    return <IconeDesceu className={`${estilos.variacao} ${estilos.desceu}`} role="img" aria-hidden={false} aria-label="Desceu" />
  return <IconeManteve className={`${estilos.variacao} ${estilos.manteve}`} role="img" aria-hidden={false} aria-label="Manteve" />
}

/** Pódio dos 3 primeiros (2º, 1º, 3º). `nuvens` desenha as nuvens do telão por baixo. */
export function Podio({ ranking, nuvens = false, claro = false }) {
  const porPosicao = Object.fromEntries(ranking.map((linha) => [linha.posicao, linha]))
  const colunas = [
    { posicao: 2, classe: estilos.prata },
    { posicao: 1, classe: estilos.ouro },
    { posicao: 3, classe: estilos.bronze },
  ]
  return (
    <div className={`${estilos.podio} ${claro ? estilos.podioClaro : ''}`} aria-label="Pódio">
      <ol className={estilos.colunasPodio}>
        {colunas.map(({ posicao, classe }) => {
          const linha = porPosicao[posicao]
          return (
            <li key={posicao} className={estilos.colunaPodio} aria-label={`${posicao}º lugar: ${linha?.apelido ?? 'vago'}`}>
              {posicao === 1 && <IconeMedalha className={estilos.medalha} aria-hidden="true" />}
              <span className={estilos.nomePodio}>{linha?.apelido ?? '\u00a0'}</span>
              <span className={`${estilos.degrau} ${classe}`}>{posicao}º</span>
            </li>
          )
        })}
      </ol>
      {nuvens && <span className={estilos.nuvens} aria-hidden="true" />}
    </div>
  )
}

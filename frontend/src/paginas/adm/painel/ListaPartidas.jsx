import { Link } from 'react-router-dom'
import { IconePerguntas } from '../../../componentes/icones/Icones'
import estilos from './ListaPartidas.module.css'
import { SITUACOES, destinoDaPartida, pinComEspaco } from './situacoes'

/**
 * Tabela de partidas do mockup ("Jogos recentes"). No celular vira uma lista de faixas
 * coloridas, uma por partida, como as alternativas do jogo no celular.
 */
export default function ListaPartidas({ partidas, rotulo = 'Partidas' }) {
  return (
    <div className={estilos.tabela}>
      <div className={estilos.cabecalho} aria-hidden="true">
        <span>Nome do jogo</span>
        <span>PIN</span>
        <span className={estilos.centro}>Jogadores</span>
        <span className={estilos.direita}>Status</span>
      </div>
      <ul className={estilos.linhas} aria-label={rotulo}>
        {partidas.map((partida) => {
          const situacao = SITUACOES[partida.situacao] ?? SITUACOES.finalizado
          return (
            <li key={partida.id}>
              <Link
                to={destinoDaPartida(partida)}
                className={`${estilos.linha} ${estilos[situacao.classe]}`}
                aria-label={`${partida.titulo}, PIN ${partida.pin}, ${partida.jogadores} ${partida.jogadores === 1 ? 'jogador' : 'jogadores'}, ${situacao.rotulo}`}
              >
                <span className={estilos.nome}>
                  <span className={estilos.icone}>
                    <IconePerguntas />
                  </span>
                  <span className={estilos.titulo}>{partida.titulo}</span>
                </span>
                <span className={estilos.pin}>{pinComEspaco(partida.pin)}</span>
                <span className={estilos.jogadores}>
                  <span className={estilos.bolha}>{partida.jogadores}</span>
                  <span className={estilos.textoJogadores}>{partida.jogadores === 1 ? 'jogador' : 'jogadores'}</span>
                </span>
                <span className={estilos.status}>
                  <span className={estilos.selo}>{situacao.rotulo}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

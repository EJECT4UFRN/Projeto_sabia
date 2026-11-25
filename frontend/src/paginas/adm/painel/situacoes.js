/** Situação da partida como aparece nas listas do painel. */
export const SITUACOES = {
  em_andamento: { rotulo: 'Em Andamento', classe: 'andamento' },
  aguardando: { rotulo: 'Aguardando', classe: 'aguardando' },
  finalizado: { rotulo: 'Finalizado', classe: 'finalizado' },
}

/** Partida ativa volta para o telão; a terminada abre o relatório. */
export const destinoDaPartida = (partida) =>
  partida.situacao === 'finalizado' ? `/adm/partidas/${partida.id}/relatorio` : `/adm/partidas/${partida.id}`

/** "482719" → "482 719" */
export const pinComEspaco = (pin) => `${pin.slice(0, 3)} ${pin.slice(3)}`

import { Outlet } from 'react-router-dom'
import { useSessao } from '../../sessao/contexto'
import BarraInferior from './BarraInferior'
import CabecalhoEstudante from './CabecalhoEstudante'
import estilos from './LayoutEstudante.module.css'

/**
 * Estrutura das telas do estudante: cabeçalho no topo e, no mobile logado, barra inferior.
 * `telaCheia` tira margens e largura máxima (tela de entrar, que ocupa a largura toda no desktop).
 * `comBarraInferior="seLogado"` mostra a barra só para quem entrou (telas abertas a visitantes).
 */
export default function LayoutEstudante({ comBarraInferior: pedido = false, telaCheia = false }) {
  const { usuario, sair } = useSessao()
  const comBarraInferior = pedido === 'seLogado' ? Boolean(usuario) : pedido

  return (
    <div className={`${estilos.layout} ${comBarraInferior ? estilos.comBarra : ''}`}>
      <CabecalhoEstudante aoSair={usuario ? sair : undefined} />
      <main className={telaCheia ? estilos.telaCheia : estilos.conteudo}>
        <Outlet />
      </main>
      {comBarraInferior && <BarraInferior />}
    </div>
  )
}

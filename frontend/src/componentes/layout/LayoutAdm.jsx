import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { IconeBusca, IconeMenu } from '../icones/Icones'
import Logo from '../marca/Logo'
import Avatar from '../usuario/Avatar'
import estilos from './LayoutAdm.module.css'
import MenuLateralAdm from './MenuLateralAdm'

/** Estrutura do painel do professor: menu lateral fixo + cabeçalho com busca e perfil. */
export default function LayoutAdm({ usuario, aoSair }) {
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className={estilos.layout}>
      <MenuLateralAdm aberto={menuAberto} aoSair={aoSair} aoNavegar={() => setMenuAberto(false)} />
      {menuAberto && (
        <button
          type="button"
          className={estilos.fundoMenu}
          aria-label="Fechar menu"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <div className={estilos.principal}>
        <header className={estilos.barraMobile}>
          <Logo variante="laranja" largura={42} semTexto />
          <button
            type="button"
            className={estilos.botaoMenu}
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto(true)}
          >
            <IconeMenu />
          </button>
        </header>

        <header className={estilos.cabecalho}>
          <label className={estilos.busca}>
            <IconeBusca />
            <span className="visualmente-oculto">Buscar</span>
            <input type="search" placeholder="Buscar quizzes ou jogadores..." />
          </label>

          {usuario && (
            <div className={estilos.usuario}>
              <div className={estilos.identificacao}>
                <span className={estilos.nome}>{usuario.nome}</span>
                <span className={estilos.papel}>Administrador</span>
              </div>
              <Avatar iniciais={usuario.iniciais} cor={usuario.corAvatar} tamanho={40} contorno />
            </div>
          )}
        </header>

        <main className={estilos.conteudo}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Botao from '../botoes/Botao'
import { IconeHistorico, IconeLivro, IconeMenu, IconePerfil, IconePin, IconeSair } from '../icones/Icones'
import Logo from '../marca/Logo'
import estilos from './CabecalhoEstudante.module.css'

const linksDesktop = [
  { para: '/perfil', rotulo: 'Perfil' },
  { para: '/materiais', rotulo: 'Materiais' },
  { para: '/como-funciona', rotulo: 'Como funciona' },
  { para: '/o-projeto', rotulo: 'O projeto' },
]

const linksMenuMobile = [
  { para: '/materiais', rotulo: 'Materiais', Icone: IconeLivro },
  { para: '/historico', rotulo: 'Histórico', Icone: IconeHistorico },
  { para: '/perfil', rotulo: 'Perfil', Icone: IconePerfil },
]

export default function CabecalhoEstudante({ aoSair }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const menuRef = useRef(null)
  // Fecha o menu ao clicar fora e ao apertar Esc; ao escolher um item, fecha pelo onClick.
  useEffect(() => {
    if (!menuAberto) return undefined
    function aoClicarFora(evento) {
      if (menuRef.current && !menuRef.current.contains(evento.target)) setMenuAberto(false)
    }
    function aoApertarTecla(evento) {
      if (evento.key === 'Escape') setMenuAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoApertarTecla)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoApertarTecla)
    }
  }, [menuAberto])

  return (
    <header className={estilos.cabecalho}>
      <div className={estilos.conteudo}>
        <Link to="/" className={estilos.marca} aria-label="Sabiá, página inicial">
          <span className={estilos.logoDesktop}>
            <Logo largura={67} corTexto="laranja" tamanhoNome={22.6} />
          </span>
          <span className={estilos.logoMobile}>
            <Logo largura={42} />
          </span>
        </Link>

        <nav className={estilos.navegacao} aria-label="Navegação principal">
          {linksDesktop.map(({ para, rotulo }) => (
            <NavLink
              key={para}
              to={para}
              className={({ isActive }) => `${estilos.link} ${isActive ? estilos.linkAtivo : ''}`}
            >
              {rotulo}
            </NavLink>
          ))}
        </nav>

        <div className={estilos.acoes}>
          <Botao para="/entrar-pin" icone={<IconePin />}>
            Entrar com PIN
          </Botao>
          <Botao para="/entrar" variante="secundario">
            Jogar agora
          </Botao>
        </div>

        <div className={estilos.menuMobile} ref={menuRef}>
          <button
            type="button"
            className={estilos.botaoMenu}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuAberto}
            aria-controls="menu-estudante"
            onClick={() => setMenuAberto((aberto) => !aberto)}
          >
            <IconeMenu />
          </button>

          {menuAberto && (
            <div id="menu-estudante" className={estilos.dropdown} onClick={() => setMenuAberto(false)}>
              <Link to="/entrar-pin" className={`${estilos.itemDropdown} ${estilos.itemPin}`}>
                <IconePin />
                Digitar PIN
              </Link>
              {linksMenuMobile.map(({ para, rotulo, Icone }) => (
                <NavLink
                  key={para}
                  to={para}
                  className={({ isActive }) =>
                    `${estilos.itemDropdown} ${isActive ? estilos.itemDropdownAtivo : ''}`
                  }
                >
                  <Icone />
                  {rotulo}
                </NavLink>
              ))}
              {aoSair && (
                <button type="button" className={`${estilos.itemDropdown} ${estilos.itemSair}`} onClick={aoSair}>
                  <IconeSair />
                  Sair da conta
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

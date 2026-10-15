import { useState } from 'react'
import { IconeOlho, IconeOlhoRiscado } from '../icones/Icones'
import CampoTexto from './CampoTexto'
import estilos from './Formulario.module.css'

/** Campo de senha com o botão de mostrar/ocultar do mockup. */
export default function CampoSenha({ comBotaoMostrar = true, ...props }) {
  const [visivel, setVisivel] = useState(false)

  const botao = comBotaoMostrar ? (
    <button
      type="button"
      className={estilos.botaoMostrar}
      aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
      aria-pressed={visivel}
      onClick={() => setVisivel((atual) => !atual)}
    >
      {visivel ? <IconeOlhoRiscado /> : <IconeOlho />}
    </button>
  ) : null

  return <CampoTexto type={visivel ? 'text' : 'password'} acessorio={botao} {...props} />
}

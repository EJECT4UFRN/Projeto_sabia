import estilos from './Formulario.module.css'

/** Botão principal do formulário: gradiente laranja → amarelo com sombra sólida. */
export default function BotaoEnviar({
  icone,
  carregando,
  textoCarregando,
  children,
  alto = false,
  className = '',
  ...props
}) {
  return (
    <button
      type="submit"
      className={`${estilos.botaoEnviar} ${alto ? estilos.botaoAlto : ''} ${className}`}
      disabled={carregando}
      aria-busy={carregando || undefined}
      {...props}
    >
      {icone && !carregando && <span className={estilos.iconeBotao}>{icone}</span>}
      {carregando && <span className={estilos.girando} aria-hidden="true" />}
      <span>{carregando ? (textoCarregando ?? children) : children}</span>
    </button>
  )
}

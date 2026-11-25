import logoColorido from '../../assets/sabia-logo.svg'
import logoLaranja from '../../assets/sabia-logo-laranja.svg'
import estilos from './Logo.module.css'

/**
 * Pássaro do Sabiá com o nome opcional.
 * - posicao "abaixo": nome embaixo do pássaro (cabeçalho do estudante)
 * - posicao "lado": nome ao lado, com subtítulo (menu do painel ADM)
 * - variante "laranja": pássaro em tons de laranja, usado no painel ADM
 */
export default function Logo({
  variante = 'colorido',
  largura = 42,
  posicao = 'abaixo',
  corTexto = 'gradiente',
  tamanhoNome,
  subtitulo,
  semTexto,
}) {
  const classes = [estilos.logo, estilos[posicao]].join(' ')

  return (
    <span className={classes}>
      <img
        src={variante === 'laranja' ? logoLaranja : logoColorido}
        alt={semTexto ? 'Sabiá' : ''}
        width={largura}
        height={Math.round(largura * 0.856)}
      />
      {!semTexto && (
        <span className={estilos.textos}>
          <span
            className={`${estilos.nome} ${estilos[`nome-${corTexto}`]}`}
            style={tamanhoNome ? { fontSize: tamanhoNome } : undefined}
          >
            SABIÁ
          </span>
          {subtitulo && <span className={estilos.subtitulo}>{subtitulo}</span>}
        </span>
      )}
    </span>
  )
}

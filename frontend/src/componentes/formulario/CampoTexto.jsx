import { useId } from 'react'
import estilos from './Formulario.module.css'

/**
 * Campo de formulário com rótulo, ícone opcional, texto de ajuda e mensagem de erro.
 * variante "linha": borda cinza reta (tela de entrar)
 * variante "arredondado": borda azulada com cantos de 8px (tela de criar conta)
 */
export default function CampoTexto({
  rotulo,
  obrigatorio = false,
  icone,
  acessorio,
  ajuda,
  erro,
  variante = 'linha',
  centralizado = false,
  centralizarNoDesktop = false,
  className = '',
  ...propsDoInput
}) {
  const id = useId()
  const idAjuda = ajuda ? `${id}-ajuda` : undefined
  const idErro = erro ? `${id}-erro` : undefined

  return (
    <div className={`${estilos.campo} ${centralizarNoDesktop ? estilos.centralizarNoDesktop : ''} ${className}`}>
      <label
        htmlFor={id}
        className={`${estilos.rotulo} ${estilos[`rotulo-${variante}`]} ${centralizado ? estilos.rotuloCentralizado : ''}`}
      >
        {rotulo}
        {obrigatorio && (
          <span className={estilos.asterisco} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <div
        className={[
          estilos.caixa,
          estilos[variante],
          icone ? estilos.comIcone : '',
          acessorio ? estilos.comAcessorio : '',
          erro ? estilos.caixaComErro : '',
        ].join(' ')}
      >
        {icone && <span className={estilos.icone}>{icone}</span>}
        <input
          id={id}
          className={`${estilos.input} ${centralizado ? estilos.inputCentralizado : ''}`}
          aria-invalid={erro ? true : undefined}
          aria-describedby={[idErro, idAjuda].filter(Boolean).join(' ') || undefined}
          required={obrigatorio}
          {...propsDoInput}
        />
        {acessorio && <span className={estilos.acessorio}>{acessorio}</span>}
      </div>
      {erro && (
        <p id={idErro} className={estilos.erro}>
          {erro}
        </p>
      )}
      {ajuda && !erro && (
        <div id={idAjuda} className={estilos.ajuda}>
          {ajuda}
        </div>
      )}
    </div>
  )
}

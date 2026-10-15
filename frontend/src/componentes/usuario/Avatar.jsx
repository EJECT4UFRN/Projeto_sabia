import estilos from './Avatar.module.css'
import { CORES_AVATAR } from './coresAvatar'

export default function Avatar({ iniciais, cor = 'laranja_sinergy', tamanho = 40, contorno = false }) {
  return (
    <span
      className={`${estilos.avatar} ${contorno ? estilos.contorno : ''}`}
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.round(tamanho * 0.35),
        background: CORES_AVATAR[cor] ?? CORES_AVATAR.laranja_sinergy,
      }}
      aria-hidden="true"
    >
      {iniciais}
    </span>
  )
}

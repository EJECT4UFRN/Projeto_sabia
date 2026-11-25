import estilos from './Avatar.module.css'
import { CORES_AVATAR, CORES_CLARAS } from './coresAvatar'

/** Iniciais sobre a cor escolhida no perfil. `quadrado` é o formato do perfil e do histórico. */
export default function Avatar({ iniciais, cor = 'amarelo', tamanho = 40, contorno = false, quadrado = false }) {
  const chave = CORES_AVATAR[cor] ? cor : 'amarelo'
  return (
    <span
      className={`${estilos.avatar} ${contorno ? estilos.contorno : ''} ${quadrado ? estilos.quadrado : ''}`}
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.round(tamanho * (quadrado ? 0.375 : 0.35)),
        background: CORES_AVATAR[chave],
        color: CORES_CLARAS.has(chave) ? '#07253a' : '#ffffff',
      }}
      aria-hidden="true"
    >
      {iniciais}
    </span>
  )
}

import estilos from './EmConstrucao.module.css'

/** Marcador das rotas cujas telas ainda serão implementadas, etapa por etapa. */
export default function EmConstrucao({ titulo }) {
  return (
    <section className={estilos.secao}>
      <p className={estilos.rotulo}>EM CONSTRUÇÃO</p>
      <h1 className={estilos.titulo}>{titulo}</h1>
      <p className={estilos.texto}>Esta tela entra numa das próximas etapas do desenvolvimento.</p>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Carregando from '../../componentes/estados/Carregando'
import Alerta from '../../componentes/formulario/Alerta'
import { IconeSetaDireita } from '../../componentes/icones/Icones'
import { buscarEstudo, marcarConcluido } from '../../servicos/materiais'
import { useSessao } from '../../sessao/contexto'
import { formatarTamanho } from '../adm/materiais/tiposMaterial'
import CapaMaterial from './CapaMaterial'
import { rotuloTipo, textoAcao } from './capas'
import estilos from './PaginaMaterial.module.css'

/** Um material aberto (tela nova: o mockup só tem a lista). Abrir conta 1 visualização por estudante. */
export default function PaginaMaterial() {
  const { id } = useParams()
  const { usuario, carregando: carregandoSessao } = useSessao()
  const [versao, setVersao] = useState(0)
  const chave = `${id}#${versao}#${usuario?.id ?? ''}`
  const [carga, setCarga] = useState({ chave: null, material: null, erro: '', status: 0 })

  useEffect(() => {
    if (carregandoSessao) return undefined
    let ativo = true
    buscarEstudo(id)
      .then((material) => ativo && setCarga({ chave, material, erro: '', status: 200 }))
      .catch((falha) => ativo && setCarga({ chave, material: null, erro: falha.message, status: falha.status }))
    return () => {
      ativo = false
    }
  }, [chave, id, carregandoSessao])

  const voltar = (
    <Link to="/materiais" className={estilos.voltar}>
      <IconeSetaDireita className={estilos.setaVoltar} />
      Continue aprendendo
    </Link>
  )

  if (carga.chave !== chave) {
    return (
      <div className={estilos.pagina}>
        {voltar}
        <Carregando texto="Abrindo material…" />
      </div>
    )
  }

  if (carga.erro) {
    const naoEncontrado = carga.status === 404
    return (
      <div className={estilos.pagina}>
        {voltar}
        <div className={estilos.estado}>
          <p className={estilos.estadoTitulo}>{naoEncontrado ? 'Material indisponível' : 'Não deu para abrir'}</p>
          <p className={estilos.estadoTexto}>
            {naoEncontrado
              ? usuario
                ? 'Ele pode ter saído do ar ou ser só para outra turma.'
                : 'Ele pode ser só para uma turma. Entre na sua conta para ver os materiais da sua turma.'
              : carga.erro}
          </p>
          {naoEncontrado && !usuario ? (
            <Link to="/entrar" state={{ voltarPara: `/materiais/${id}` }} className={estilos.botao}>
              Entrar
            </Link>
          ) : (
            !naoEncontrado && (
              <button type="button" className={estilos.botao} onClick={() => setVersao((v) => v + 1)}>
                Tentar de novo
              </button>
            )
          )}
        </div>
      </div>
    )
  }

  return <Material key={chave} materialInicial={carga.material} voltar={voltar} logado={Boolean(usuario)} />
}

function Material({ materialInicial, voltar, logado }) {
  const [material, setMaterial] = useState(materialInicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function alternarConcluido() {
    setSalvando(true)
    setErro('')
    try {
      setMaterial(await marcarConcluido(material.id, !material.concluido))
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setSalvando(false)
    }
  }

  const link = material.tipo === 'documento' ? material.arquivo : material.url
  const tamanho = material.tipo === 'documento' ? formatarTamanho(material.tamanho) : ''

  return (
    <div className={estilos.pagina}>
      {voltar}
      <article className={estilos.material}>
        <div className={estilos.midia}>
          {material.youtube_id ? (
            <div className={estilos.video}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${material.youtube_id}`}
                title={`Vídeo: ${material.titulo}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <CapaMaterial material={material} grande />
          )}
        </div>

        <div className={estilos.info}>
          <p className={estilos.linhaTipo}>
            <span className={estilos.tipo}>{rotuloTipo(material)}</span>
            <span>{material.disciplina}</span>
          </p>
          <h1 className={estilos.titulo}>{material.titulo}</h1>
          {material.descricao && <p className={estilos.descricao}>{material.descricao}</p>}
          <p className={estilos.professor}>Material de {material.professor}</p>

          {!material.youtube_id && link && (
            <a href={link} target="_blank" rel="noreferrer" className={estilos.botaoPrincipal}>
              {textoAcao(material)}
              {tamanho && <span className={estilos.tamanho}>{tamanho}</span>}
              <IconeSetaDireita />
            </a>
          )}
          {material.youtube_id && (
            <a href={material.url} target="_blank" rel="noreferrer" className={estilos.linkExterno}>
              Abrir no YouTube
            </a>
          )}

          {material.permitir_concluir && (
            <div className={estilos.concluir}>
              {logado ? (
                <button
                  type="button"
                  className={`${estilos.botaoConcluir} ${material.concluido ? estilos.feito : ''}`}
                  aria-pressed={material.concluido}
                  disabled={salvando}
                  onClick={alternarConcluido}
                >
                  {material.concluido ? '✓ Concluído' : 'Marcar como concluído'}
                </button>
              ) : (
                <p className={estilos.dica}>
                  <Link to="/entrar">Entre na sua conta</Link> para marcar como concluído.
                </p>
              )}
              {material.concluido && logado && (
                <p className={estilos.dica}>Clique de novo se quiser desmarcar.</p>
              )}
              <Alerta>{erro}</Alerta>
            </div>
          )}
        </div>
      </article>
    </div>
  )
}

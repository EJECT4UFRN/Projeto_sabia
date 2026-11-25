import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import imagemPreviaPdf from '../../../assets/materiais/previa-pdf.svg'
import imagemPreviaVideo from '../../../assets/materiais/previa-video.svg'
import Carregando from '../../../componentes/estados/Carregando'
import Alerta from '../../../componentes/formulario/Alerta'
import {
  IconeAdicionarImagem,
  IconeArtigo,
  IconeEnviarArquivo,
  IconeImagemMoldura,
} from '../../../componentes/icones/Icones'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import CabecalhoPagina from '../../../componentes/painel/CabecalhoPagina'
import SeletorDisciplina from '../../../componentes/painel/SeletorDisciplina'
import { listarDisciplinas, listarTurmas } from '../../../servicos/escola'
import { buscarMaterial, salvarMaterial } from '../../../servicos/materiais'
import estilos from './PaginaEditorMaterial.module.css'
import { TIPOS_MATERIAL, formatarTamanho, tipoMaterial } from './tiposMaterial'

const TAMANHO_ARQUIVO = 20 * 1024 * 1024
const TAMANHO_CAPA = 5 * 1024 * 1024
const EXTENSOES_ARQUIVO = ['pdf', 'doc', 'docx']
const TIPOS_CAPA = ['image/jpeg', 'image/png', 'image/webp']
const DURACAO = /^(?:\d{1,2}:)?\d{1,3}:[0-5]\d$/
const LINK = /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i
const CAMPOS = ['titulo', 'descricao', 'disciplina', 'tipo', 'arquivo', 'url', 'duracao', 'tempo_leitura', 'capa', 'turmas_ids']

const FORM_VAZIO = {
  titulo: '',
  descricao: '',
  disciplina: '',
  tipo: 'documento',
  url: '',
  duracao: '',
  tempo_leitura: '',
  publico: false,
  turmas: [],
  publicar: true,
  permitir_concluir: false,
}

function paraFormulario(material) {
  return {
    titulo: material.titulo,
    descricao: material.descricao,
    disciplina: String(material.disciplina),
    tipo: material.tipo,
    url: material.url,
    duracao: material.duracao,
    tempo_leitura: material.tempo_leitura ? String(material.tempo_leitura) : '',
    publico: material.publico,
    turmas: material.turmas.map((t) => t.id),
    publicar: material.status === 'publicado',
    permitir_concluir: material.permitir_concluir,
  }
}

const extensao = (nome) => nome.split('.').pop().toLowerCase()

function validar(form, { arquivo, temArquivoSalvo, capa }) {
  const erros = {}
  if (!form.titulo.trim()) erros.titulo = 'Dê um título para o material.'
  if (!form.disciplina) erros.disciplina = 'Escolha a disciplina.'
  if (form.tipo === 'documento') {
    if (!arquivo && !temArquivoSalvo) erros.arquivo = 'Envie o arquivo do material.'
    else if (arquivo && !EXTENSOES_ARQUIVO.includes(extensao(arquivo.name))) {
      erros.arquivo = 'Envie um arquivo PDF, DOC ou DOCX.'
    } else if (arquivo && arquivo.size > TAMANHO_ARQUIVO) erros.arquivo = 'O arquivo pode ter no máximo 20 MB.'
  } else {
    const url = form.url.trim()
    if (!url) erros.url = form.tipo === 'video' ? 'Cole o link do vídeo.' : 'Cole o link do artigo.'
    else if (!LINK.test(url)) erros.url = 'Digite um link completo, começando com https://'
  }
  if (form.tipo === 'video' && form.duracao.trim() && !DURACAO.test(form.duracao.replace(/\s/g, ''))) {
    erros.duracao = 'Use o formato mm:ss (ex.: 08:30).'
  }
  if (form.tipo === 'artigo' && form.tempo_leitura) {
    const minutos = Number(form.tempo_leitura)
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 300) erros.tempo_leitura = 'Use de 1 a 300 minutos.'
  }
  if (capa && !TIPOS_CAPA.includes(capa.type)) erros.capa = 'Use uma imagem JPG, PNG ou WEBP.'
  else if (capa && capa.size > TAMANHO_CAPA) erros.capa = 'A imagem pode ter no máximo 5 MB.'
  if (form.publicar && !form.publico && form.turmas.length === 0) {
    erros.turmas_ids = 'Escolha ao menos uma turma ou deixe o material público.'
  }
  return erros
}

function paraEnvio(form) {
  return {
    titulo: form.titulo,
    descricao: form.descricao,
    disciplina: form.disciplina,
    tipo: form.tipo,
    url: form.tipo === 'documento' ? '' : form.url.trim(),
    duracao: form.tipo === 'video' ? form.duracao.replace(/\s/g, '') : '',
    tempo_leitura: form.tipo === 'artigo' ? form.tempo_leitura : '',
    publico: form.publico,
    turmas_ids: form.turmas,
    status: form.publicar ? 'publicado' : 'rascunho',
    permitir_concluir: form.permitir_concluir,
  }
}

/** Carrega disciplinas, turmas e (na edição) o material, e entrega o formulário pronto. */
export default function PaginaEditorMaterial() {
  const { id } = useParams()
  const [versao, setVersao] = useState(0)
  const chave = `${id ?? 'novo'}#${versao}`
  const [carga, setCarga] = useState({ chave: null, dados: null, erro: '' })

  useEffect(() => {
    let ativo = true
    Promise.all([listarDisciplinas(), listarTurmas(), id ? buscarMaterial(id) : Promise.resolve(null)])
      .then(([disciplinas, turmas, material]) => {
        if (ativo) setCarga({ chave, dados: { disciplinas, turmas, material }, erro: '' })
      })
      .catch((falha) => {
        if (!ativo) return
        const erro = falha.status === 404 ? 'Este material não existe mais.' : falha.message
        setCarga({ chave, dados: null, erro })
      })
    return () => {
      ativo = false
    }
  }, [chave, id])

  const titulo = id ? 'Editar material' : 'Novo material'
  const cabecalho = (
    <CabecalhoPagina
      migalhas={[
        { rotulo: 'Dashboard', para: '/adm' },
        { rotulo: 'Materiais', para: '/adm/materiais' },
        { rotulo: titulo },
      ]}
      titulo={titulo}
      descricao="Configure o conteúdo e defina quais turmas poderão acessá-lo."
    />
  )

  if (carga.chave !== chave) {
    return (
      <>
        {cabecalho}
        <Carregando texto="Carregando material…" />
      </>
    )
  }
  if (carga.erro) {
    return (
      <>
        {cabecalho}
        <div className={estilos.estado}>
          <Alerta>{carga.erro}</Alerta>
          <div className={estilos.botoesEstado}>
            <BotaoPainel variante="contorno" para="/adm/materiais">
              Voltar para materiais
            </BotaoPainel>
            <BotaoPainel variante="escuro" onClick={() => setVersao((v) => v + 1)}>
              Tentar de novo
            </BotaoPainel>
          </div>
        </div>
      </>
    )
  }
  return (
    <>
      {cabecalho}
      <Editor key={chave} {...carga.dados} />
    </>
  )
}

function Editor({ material, disciplinas: disciplinasIniciais, turmas }) {
  const navegar = useNavigate()
  const ids = useId()
  const entradaArquivo = useRef(null)
  const entradaCapa = useRef(null)
  const [form, setForm] = useState(() => (material ? paraFormulario(material) : FORM_VAZIO))
  const [disciplinas, setDisciplinas] = useState(disciplinasIniciais)
  const [arquivo, setArquivo] = useState(null)
  const [capa, setCapa] = useState(null)
  const [removerCapa, setRemoverCapa] = useState(false)
  const [previaCapa, setPreviaCapa] = useState(null)
  const [arrastando, setArrastando] = useState(false)
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [salvando, setSalvando] = useState(false)

  const enderecoPrevia = useRef(null)

  // Endereço temporário da imagem escolhida (para a prévia), liberado ao trocar ou sair da tela.
  function trocarPrevia(imagem) {
    if (enderecoPrevia.current) URL.revokeObjectURL?.(enderecoPrevia.current)
    enderecoPrevia.current = imagem && URL.createObjectURL ? URL.createObjectURL(imagem) : null
    setPreviaCapa(enderecoPrevia.current)
  }
  useEffect(() => () => enderecoPrevia.current && URL.revokeObjectURL?.(enderecoPrevia.current), [])

  const tipo = tipoMaterial(form.tipo)
  const capaAtual = capa ? previaCapa : removerCapa ? null : material?.capa_url
  const temArquivoSalvo = Boolean(material?.arquivo && material.tipo === 'documento')
  const todasMarcadas = turmas.length > 0 && form.turmas.length === turmas.length
  const disciplinaEscolhida = disciplinas.find((d) => String(d.id) === form.disciplina)

  function mudar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setErros((atuais) => ({ ...atuais, [campo === 'turmas' || campo === 'publico' ? 'turmas_ids' : campo]: '' }))
  }

  function alternarTurma(turmaId) {
    mudar('turmas', form.turmas.includes(turmaId) ? form.turmas.filter((t) => t !== turmaId) : [...form.turmas, turmaId])
  }

  function escolherArquivo(lista) {
    const escolhido = lista?.[0]
    if (!escolhido) return
    setArquivo(escolhido)
    setErros((atuais) => ({ ...atuais, arquivo: validar({ ...form, tipo: 'documento' }, { arquivo: escolhido }).arquivo }))
  }

  function escolherCapa(lista) {
    const escolhida = lista?.[0]
    if (!escolhida) return
    setCapa(escolhida)
    trocarPrevia(escolhida)
    setRemoverCapa(false)
    setErros((atuais) => ({ ...atuais, capa: validar(form, { capa: escolhida, temArquivoSalvo: true }).capa }))
  }

  function tirarCapa() {
    setCapa(null)
    trocarPrevia(null)
    setRemoverCapa(Boolean(material?.capa_url))
    if (entradaCapa.current) entradaCapa.current.value = ''
  }

  async function salvar(evento) {
    evento.preventDefault()
    const encontrados = validar(form, { arquivo, temArquivoSalvo, capa })
    setErros(encontrados)
    if (Object.keys(encontrados).length) {
      setErroGeral('Confira os campos destacados.')
      return
    }
    setErroGeral('')
    setSalvando(true)
    try {
      const salvo = await salvarMaterial(material?.id, paraEnvio(form), {
        arquivo: form.tipo === 'documento' ? arquivo : null,
        capa,
        removerCapa: removerCapa && !capa,
      })
      const aviso = material
        ? `“${salvo.titulo}” foi atualizado.`
        : salvo.status === 'publicado'
          ? `“${salvo.titulo}” foi publicado.`
          : `“${salvo.titulo}” foi salvo como rascunho.`
      navegar('/adm/materiais', { state: { aviso } })
    } catch (falha) {
      const doServidor = {}
      CAMPOS.forEach((campo) => {
        const mensagem = falha.doCampo?.(campo)
        if (mensagem) doServidor[campo] = mensagem
      })
      if (falha.doCampo?.('status')) doServidor.turmas_ids = falha.doCampo('status')
      setErros(doServidor)
      setErroGeral(Object.keys(doServidor).length ? 'Confira os campos destacados.' : falha.message)
      setSalvando(false)
    }
  }

  const erroDe = (campo) =>
    erros[campo] && (
      <span id={`${ids}-${campo}-erro`} className={estilos.erro}>
        {erros[campo]}
      </span>
    )
  const ligarErro = (campo) => ({
    'aria-invalid': Boolean(erros[campo]),
    'aria-describedby': erros[campo] ? `${ids}-${campo}-erro` : undefined,
  })

  return (
    <form className={estilos.layout} onSubmit={salvar} noValidate>
      <div className={estilos.principal}>
        {erroGeral && <Alerta>{erroGeral}</Alerta>}

        <section className={estilos.cartao} aria-labelledby={`${ids}-info`}>
          <h2 id={`${ids}-info`} className={estilos.tituloSecao}>
            Informações do material
          </h2>
          <div className={estilos.campo}>
            <label className={estilos.rotulo} htmlFor={`${ids}-titulo`}>
              Título do material *
            </label>
            <input
              id={`${ids}-titulo`}
              className={estilos.entrada}
              maxLength={120}
              placeholder="Ex.: Sistema Solar — Introdução"
              value={form.titulo}
              onChange={(e) => mudar('titulo', e.target.value)}
              {...ligarErro('titulo')}
            />
            {erroDe('titulo')}
          </div>
          <div className={estilos.campo}>
            <label className={estilos.rotulo} htmlFor={`${ids}-descricao`}>
              Descrição
            </label>
            <textarea
              id={`${ids}-descricao`}
              className={`${estilos.entrada} ${estilos.descricao}`}
              maxLength={300}
              placeholder="Explique brevemente o conteúdo e o objetivo deste material."
              value={form.descricao}
              onChange={(e) => mudar('descricao', e.target.value)}
              {...ligarErro('descricao')}
            />
            {erroDe('descricao')}
          </div>
          <div className={estilos.dupla}>
            <div className={estilos.campo}>
              <label className={estilos.rotulo} htmlFor={`${ids}-disciplina`}>
                Disciplina *
              </label>
              <SeletorDisciplina
                id={`${ids}-disciplina`}
                className={estilos.entrada}
                valor={form.disciplina}
                aoMudar={(valor) => mudar('disciplina', valor)}
                disciplinas={disciplinas}
                aoCadastrar={(nova) =>
                  setDisciplinas((lista) => [...lista, nova].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
                }
                {...ligarErro('disciplina')}
              />
              {erroDe('disciplina')}
            </div>
            <div className={estilos.campo}>
              <label className={estilos.rotulo} htmlFor={`${ids}-tipo`}>
                Tipo de material *
              </label>
              <select
                id={`${ids}-tipo`}
                className={estilos.entrada}
                value={form.tipo}
                onChange={(e) => mudar('tipo', e.target.value)}
              >
                {TIPOS_MATERIAL.map(({ valor, rotuloSelecao }) => (
                  <option key={valor} value={valor}>
                    {rotuloSelecao}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className={estilos.cartao} aria-labelledby={`${ids}-conteudo`}>
          <h2 id={`${ids}-conteudo`} className={estilos.tituloSecao}>
            Conteúdo do material
          </h2>
          {form.tipo === 'documento' ? (
            <div className={estilos.campo}>
              <div
                className={`${estilos.soltar} ${arrastando ? estilos.arrastando : ''} ${erros.arquivo ? estilos.soltarErro : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setArrastando(true)
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setArrastando(false)
                  escolherArquivo(e.dataTransfer.files)
                }}
              >
                <span className={estilos.iconeEnviar}>
                  <IconeEnviarArquivo />
                </span>
                {arquivo || temArquivoSalvo ? (
                  <>
                    <p className={estilos.nomeArquivo}>{arquivo ? arquivo.name : material.arquivo_nome}</p>
                    <p className={estilos.dica}>
                      {formatarTamanho(arquivo ? arquivo.size : material.tamanho)}
                      {!arquivo && material.arquivo && (
                        <>
                          {' · '}
                          <a href={material.arquivo} target="_blank" rel="noreferrer">
                            abrir arquivo atual
                          </a>
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p className={estilos.textoSoltar}>Arraste seu arquivo aqui</p>
                    <p className={estilos.dica}>PDF, DOC ou DOCX · até 20 MB</p>
                  </>
                )}
                <button type="button" className={estilos.botaoArquivo} onClick={() => entradaArquivo.current?.click()}>
                  {arquivo || temArquivoSalvo ? 'Trocar arquivo' : 'Selecionar arquivo'}
                </button>
                <input
                  ref={entradaArquivo}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="visualmente-oculto"
                  aria-label="Arquivo do material"
                  tabIndex={-1}
                  onChange={(e) => escolherArquivo(e.target.files)}
                  {...ligarErro('arquivo')}
                />
              </div>
              {erroDe('arquivo')}
            </div>
          ) : (
            <div className={estilos.linhaLink}>
              <div className={estilos.campo}>
                <label className={estilos.rotulo} htmlFor={`${ids}-url`}>
                  {form.tipo === 'video' ? 'URL do vídeo *' : 'URL do artigo *'}
                </label>
                <input
                  id={`${ids}-url`}
                  type="url"
                  className={estilos.entrada}
                  maxLength={500}
                  placeholder={form.tipo === 'video' ? 'https://youtube.com/watch?v=...' : 'https://...'}
                  value={form.url}
                  onChange={(e) => mudar('url', e.target.value)}
                  {...ligarErro('url')}
                />
                {erroDe('url')}
              </div>
              {form.tipo === 'video' ? (
                <div className={`${estilos.campo} ${estilos.campoCurto}`}>
                  <label className={estilos.rotulo} htmlFor={`${ids}-duracao`}>
                    Duração <span className={estilos.opcional}>(opcional)</span>
                  </label>
                  <input
                    id={`${ids}-duracao`}
                    className={estilos.entrada}
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="08:30"
                    value={form.duracao}
                    onChange={(e) => mudar('duracao', e.target.value)}
                    {...ligarErro('duracao')}
                  />
                  {erroDe('duracao')}
                </div>
              ) : (
                <div className={`${estilos.campo} ${estilos.campoCurto}`}>
                  <label className={estilos.rotulo} htmlFor={`${ids}-leitura`}>
                    Leitura (min) <span className={estilos.opcional}>(opcional)</span>
                  </label>
                  <input
                    id={`${ids}-leitura`}
                    className={estilos.entrada}
                    type="number"
                    min={1}
                    max={300}
                    placeholder="8"
                    value={form.tempo_leitura}
                    onChange={(e) => mudar('tempo_leitura', e.target.value)}
                    {...ligarErro('tempo_leitura')}
                  />
                  {erroDe('tempo_leitura')}
                </div>
              )}
            </div>
          )}
        </section>

        <section className={estilos.cartao} aria-labelledby={`${ids}-capa`}>
          <h2 id={`${ids}-capa`} className={estilos.tituloSecao}>
            Imagem de capa <span className={estilos.opcional}>(opcional)</span>
          </h2>
          <div className={estilos.linhaCapa}>
            <div className={estilos.molduraCapa}>
              {capaAtual ? (
                <img src={capaAtual} alt="Capa escolhida" className={estilos.imagemCapa} />
              ) : (
                <span className={estilos.iconeMoldura}>
                  <IconeImagemMoldura />
                </span>
              )}
            </div>
            <div className={estilos.acoesCapa}>
              <div className={estilos.botoesCapa}>
                <BotaoPainel
                  variante="contornoAzul"
                  icone={<IconeAdicionarImagem />}
                  className={estilos.botaoImagem}
                  onClick={() => entradaCapa.current?.click()}
                >
                  {capaAtual ? 'Trocar imagem' : 'Selecionar imagem'}
                </BotaoPainel>
                {capaAtual && (
                  <button type="button" className={estilos.remover} onClick={tirarCapa}>
                    Remover
                  </button>
                )}
              </div>
              <p className={estilos.dica}>
                JPG, PNG ou WEBP. Sem imagem, o tipo do material será usado como representação.
              </p>
              <input
                ref={entradaCapa}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="visualmente-oculto"
                aria-label="Imagem de capa"
                tabIndex={-1}
                onChange={(e) => escolherCapa(e.target.files)}
                {...ligarErro('capa')}
              />
              {erroDe('capa')}
            </div>
          </div>
        </section>

        <fieldset className={estilos.cartao} aria-describedby={`${ids}-turmas-dica`}>
          <legend className={estilos.legenda}>Disponibilizar para</legend>
          <p id={`${ids}-turmas-dica`} className={estilos.subtitulo}>
            Somente alunos das turmas selecionadas poderão visualizar o material.
          </p>
          <div className={estilos.opcoes}>
            <label className={`${estilos.opcao} ${estilos.opcaoPublico}`}>
              <input
                type="checkbox"
                className={estilos.caixa}
                checked={form.publico}
                onChange={(e) => mudar('publico', e.target.checked)}
              />
              <span>
                <strong>Público</strong>
                <span className={estilos.detalheOpcao}>Qualquer pessoa vê, mesmo sem conta</span>
              </span>
            </label>
            {turmas.length > 0 ? (
              <>
                <label className={`${estilos.opcao} ${estilos.opcaoTodas}`}>
                  <input
                    type="checkbox"
                    className={estilos.caixa}
                    checked={todasMarcadas}
                    onChange={(e) => mudar('turmas', e.target.checked ? turmas.map((t) => t.id) : [])}
                  />
                  <strong>Todas as minhas turmas</strong>
                </label>
                {turmas.map((turma) => (
                  <label key={turma.id} className={estilos.opcao}>
                    <input
                      type="checkbox"
                      className={estilos.caixa}
                      checked={form.turmas.includes(turma.id)}
                      onChange={() => alternarTurma(turma.id)}
                    />
                    <span>{turma.nome}</span>
                  </label>
                ))}
              </>
            ) : (
              <p className={estilos.semTurmas}>
                Você ainda não tem turmas. <Link to="/adm/turmas">Crie uma turma</Link> para liberar o material só para
                os seus alunos.
              </p>
            )}
          </div>
          {erroDe('turmas_ids')}
        </fieldset>

        <fieldset className={estilos.cartao}>
          <legend className={estilos.legenda}>Publicação</legend>
          <div className={estilos.listaRadios}>
            <label className={estilos.opcao}>
              <input
                type="radio"
                name={`${ids}-publicacao`}
                className={estilos.radio}
                checked={form.publicar}
                onChange={() => mudar('publicar', true)}
              />
              <span>Publicar agora</span>
            </label>
            <label className={estilos.opcao}>
              <input
                type="radio"
                name={`${ids}-publicacao`}
                className={estilos.radio}
                checked={!form.publicar}
                onChange={() => mudar('publicar', false)}
              />
              <span>Salvar como rascunho</span>
            </label>
          </div>
          <label className={estilos.concluir}>
            <input
              type="checkbox"
              className={estilos.caixa}
              checked={form.permitir_concluir}
              onChange={(e) => mudar('permitir_concluir', e.target.checked)}
            />
            <span>Permitir que alunos marquem como concluído</span>
          </label>
        </fieldset>
      </div>

      <aside className={estilos.lateral} aria-label="Pré-visualização">
        <div className={estilos.previa}>
          <header className={estilos.cabecaPrevia}>
            <h2 className={estilos.tituloSecao}>Pré-visualização</h2>
            <p className={estilos.dica}>Como aparecerá para o estudante</p>
          </header>
          <div className={estilos.corpoPrevia}>
            <div className={estilos.capaPrevia}>
              {capaAtual ? (
                <img src={capaAtual} alt="" className={estilos.imagemCapa} />
              ) : form.tipo === 'artigo' ? (
                <span className={estilos.iconeArtigo}>
                  <IconeArtigo />
                </span>
              ) : (
                <img
                  src={form.tipo === 'video' ? imagemPreviaVideo : imagemPreviaPdf}
                  alt=""
                  className={estilos.iconePrevia}
                />
              )}
            </div>
            <p className={estilos.tipoPrevia}>{tipo.rotulo}</p>
            <p className={estilos.tituloPrevia}>{form.titulo.trim() || 'Título do material'}</p>
            <p className={estilos.descricaoPrevia}>
              {form.descricao.trim() || 'A descrição do material aparecerá aqui.'}
            </p>
            <p className={estilos.disciplinaPrevia}>{disciplinaEscolhida?.nome ?? 'Disciplina'}</p>
          </div>
        </div>
      </aside>

      <footer className={estilos.rodape}>
        <BotaoPainel variante="contorno" para="/adm/materiais" className={estilos.cancelar}>
          Cancelar
        </BotaoPainel>
        <BotaoPainel type="submit" disabled={salvando} className={estilos.salvar}>
          {salvando ? 'Salvando…' : form.publicar ? 'Publicar material' : 'Salvar material'}
        </BotaoPainel>
      </footer>
    </form>
  )
}

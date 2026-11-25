import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Carregando from '../../../componentes/estados/Carregando'
import Alerta from '../../../componentes/formulario/Alerta'
import { IconeCopiar, IconeLapis, IconeLixeira, IconeLupa, IconeSincronizar } from '../../../componentes/icones/Icones'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import CabecalhoPagina from '../../../componentes/painel/CabecalhoPagina'
import Modal from '../../../componentes/painel/Modal'
import Avatar from '../../../componentes/usuario/Avatar'
import {
  adicionarAluno,
  buscarAlunos,
  buscarTurma,
  excluirTurma,
  gerarNovoCodigo,
  removerAluno,
} from '../../../servicos/escola'
import ModalNomeTurma from './ModalNomeTurma'
import estilos from './Turmas.module.css'

const ESPERA_BUSCA = 300

/** Uma turma: código para os alunos entrarem, busca para adicionar e lista de alunos. */
export default function PaginaTurma() {
  const { id } = useParams()
  const [versao, setVersao] = useState(0)
  const chave = `${id}#${versao}`
  const [carga, setCarga] = useState({ chave: null, turma: null, erro: '' })

  useEffect(() => {
    let ativo = true
    buscarTurma(id)
      .then((turma) => ativo && setCarga({ chave, turma, erro: '' }))
      .catch((falha) => {
        if (ativo) setCarga({ chave, turma: null, erro: falha.status === 404 ? 'Esta turma não existe mais.' : falha.message })
      })
    return () => {
      ativo = false
    }
  }, [chave, id])

  if (carga.chave !== chave) {
    return (
      <>
        <CabecalhoPagina migalhas={[{ rotulo: 'Turmas', para: '/adm/turmas' }, { rotulo: 'Turma' }]} titulo="Turma" />
        <Carregando texto="Carregando turma…" />
      </>
    )
  }
  if (carga.erro) {
    return (
      <>
        <CabecalhoPagina migalhas={[{ rotulo: 'Turmas', para: '/adm/turmas' }, { rotulo: 'Turma' }]} titulo="Turma" />
        <div className={estilos.estado}>
          <Alerta>{carga.erro}</Alerta>
          <div className={estilos.botoesEstado}>
            <BotaoPainel variante="contorno" para="/adm/turmas">
              Voltar para turmas
            </BotaoPainel>
            <BotaoPainel variante="escuro" onClick={() => setVersao((v) => v + 1)}>
              Tentar de novo
            </BotaoPainel>
          </div>
        </div>
      </>
    )
  }
  return <DetalheTurma key={chave} turmaInicial={carga.turma} />
}

function DetalheTurma({ turmaInicial }) {
  const navegar = useNavigate()
  const local = useLocation()
  const idBusca = useId()
  const [turma, setTurma] = useState(turmaInicial)
  const [aviso, setAviso] = useState(local.state?.aviso ?? '')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(null)
  const [renomeando, setRenomeando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [apagando, setApagando] = useState(false)

  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const esperaBusca = useRef(null)
  const [encontrados, setEncontrados] = useState({ termo: '', alunos: [], erro: '' })
  const buscando = termo.length >= 2 && encontrados.termo !== termo

  useEffect(() => {
    if (local.state?.aviso) navegar(local.pathname, { replace: true, state: null })
  }, [local, navegar])

  useEffect(() => {
    if (termo.length < 2) return undefined
    let ativo = true
    buscarAlunos(termo)
      .then((alunos) => ativo && setEncontrados({ termo, alunos, erro: '' }))
      .catch((falha) => ativo && setEncontrados({ termo, alunos: [], erro: falha.message }))
    return () => {
      ativo = false
    }
  }, [termo])

  useEffect(() => () => clearTimeout(esperaBusca.current), [])

  function digitar(valor) {
    setBusca(valor)
    clearTimeout(esperaBusca.current)
    esperaBusca.current = setTimeout(() => setTermo(valor.trim()), ESPERA_BUSCA)
  }

  async function executar(chave, acao, mensagem) {
    setOcupado(chave)
    setErro('')
    setAviso('')
    try {
      const atualizada = await acao()
      setTurma(atualizada)
      if (mensagem) setAviso(mensagem(atualizada))
    } catch (falha) {
      setErro(falha.doCampo?.('aluno_id') ?? falha.message)
    } finally {
      setOcupado(null)
    }
  }

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(turma.codigo)
      setAviso(`Código ${turma.codigo} copiado.`)
    } catch {
      setAviso(`O código da turma é ${turma.codigo}.`)
    }
  }

  async function confirmarExclusao() {
    setApagando(true)
    try {
      await excluirTurma(turma.id)
      navegar('/adm/turmas', { state: { aviso: `Turma “${turma.nome}” excluída.` } })
    } catch (falha) {
      setErro(falha.message)
      setApagando(false)
      setExcluindo(false)
    }
  }

  const naTurma = new Set(turma.alunos.map((a) => a.id))
  const mostrarResultados = termo.length >= 2 && busca.trim().length >= 2

  return (
    <>
      <CabecalhoPagina
        migalhas={[
          { rotulo: 'Dashboard', para: '/adm' },
          { rotulo: 'Turmas', para: '/adm/turmas' },
          { rotulo: turma.nome },
        ]}
        titulo={turma.nome}
        descricao={`${turma.alunos_total} ${turma.alunos_total === 1 ? 'aluno' : 'alunos'} nesta turma.`}
      >
        <BotaoPainel variante="contornoAzul" icone={<IconeLapis />} onClick={() => setRenomeando(true)}>
          Renomear
        </BotaoPainel>
      </CabecalhoPagina>

      {aviso && (
        <div className={estilos.aviso}>
          <Alerta tipo="sucesso">{aviso}</Alerta>
        </div>
      )}
      {erro && (
        <div className={estilos.aviso}>
          <Alerta>{erro}</Alerta>
        </div>
      )}

      <div className={estilos.detalhe}>
        <section className={estilos.cartao} aria-labelledby={`${idBusca}-alunos`}>
          <h2 id={`${idBusca}-alunos`} className={estilos.tituloSecao}>
            Alunos
          </h2>
          <div className={estilos.campoBusca}>
            <label className={estilos.rotulo} htmlFor={idBusca}>
              Adicionar aluno
            </label>
            <div className={estilos.busca}>
              <span className={estilos.lupa}>
                <IconeLupa />
              </span>
              <input
                id={idBusca}
                type="search"
                className={estilos.entrada}
                placeholder="Nome, usuário ou e-mail do aluno"
                autoComplete="off"
                value={busca}
                onChange={(e) => digitar(e.target.value)}
              />
            </div>
            {mostrarResultados && (
              <div className={estilos.resultados} aria-live="polite" aria-busy={buscando}>
                {buscando ? (
                  <p className={estilos.textoResultado}>Buscando…</p>
                ) : encontrados.erro ? (
                  <p className={estilos.textoResultado}>{encontrados.erro}</p>
                ) : encontrados.alunos.length === 0 ? (
                  <p className={estilos.textoResultado}>Nenhum aluno com “{termo}”. Confira se ele já criou a conta.</p>
                ) : (
                  <ul className={estilos.listaAlunos} aria-label="Alunos encontrados">
                    {encontrados.alunos.map((aluno) => (
                      <li key={aluno.id} className={estilos.aluno}>
                        <Avatar iniciais={aluno.iniciais} cor={aluno.cor_avatar} tamanho={36} />
                        <span className={estilos.nomeAluno}>
                          {aluno.nome}
                          <span className={estilos.usuario}>@{aluno.username}</span>
                        </span>
                        {naTurma.has(aluno.id) ? (
                          <span className={estilos.jaEsta}>Na turma</span>
                        ) : (
                          <button
                            type="button"
                            className={estilos.adicionar}
                            disabled={ocupado === `+${aluno.id}`}
                            aria-label={`Adicionar ${aluno.nome}`}
                            onClick={() =>
                              executar(`+${aluno.id}`, () => adicionarAluno(turma.id, aluno.id), () => `${aluno.nome} entrou na turma.`)
                            }
                          >
                            Adicionar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {turma.alunos.length === 0 ? (
            <p className={estilos.semAlunos}>
              Ninguém na turma ainda. Busque acima ou passe o código <strong>{turma.codigo}</strong> para os alunos.
            </p>
          ) : (
            <ul className={estilos.listaAlunos} aria-label="Alunos da turma">
              {turma.alunos.map((aluno) => (
                <li key={aluno.id} className={estilos.aluno}>
                  <Avatar iniciais={aluno.iniciais} cor={aluno.cor_avatar} tamanho={36} />
                  <span className={estilos.nomeAluno}>
                    {aluno.nome}
                    <span className={estilos.usuario}>@{aluno.username}</span>
                  </span>
                  <button
                    type="button"
                    className={estilos.remover}
                    disabled={ocupado === `-${aluno.id}`}
                    aria-label={`Tirar ${aluno.nome} da turma`}
                    title="Tirar da turma"
                    onClick={() =>
                      executar(`-${aluno.id}`, () => removerAluno(turma.id, aluno.id), () => `${aluno.nome} saiu da turma.`)
                    }
                  >
                    <IconeLixeira />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className={estilos.coluna}>
          <section className={`${estilos.cartao} ${estilos.cartaoCodigo}`} aria-labelledby={`${idBusca}-codigo`}>
            <h2 id={`${idBusca}-codigo`} className={estilos.tituloSecao}>
              Código da turma
            </h2>
            <p className={estilos.codigo} aria-label={`Código ${turma.codigo.split('').join(' ')}`}>
              {turma.codigo}
            </p>
            <p className={estilos.dica}>O aluno digita este código em Perfil → Minhas turmas para entrar sozinho.</p>
            <div className={estilos.botoesCodigo}>
              <BotaoPainel variante="escuro" icone={<IconeCopiar />} onClick={copiarCodigo}>
                Copiar código
              </BotaoPainel>
              <BotaoPainel
                variante="contornoAzul"
                icone={<IconeSincronizar />}
                disabled={ocupado === 'codigo'}
                onClick={() =>
                  executar('codigo', () => gerarNovoCodigo(turma.id), (nova) => `Novo código: ${nova.codigo}. O anterior não funciona mais.`)
                }
              >
                Gerar novo código
              </BotaoPainel>
            </div>
          </section>

          <section className={estilos.cartao} aria-labelledby={`${idBusca}-excluir`}>
            <h2 id={`${idBusca}-excluir`} className={estilos.tituloSecao}>
              Excluir turma
            </h2>
            <p className={estilos.dica}>
              Os alunos continuam com a conta; só perdem os materiais liberados apenas para esta turma.
            </p>
            <BotaoPainel variante="perigo" icone={<IconeLixeira />} onClick={() => setExcluindo(true)}>
              Excluir turma
            </BotaoPainel>
          </section>
        </div>
      </div>

      <ModalNomeTurma
        key={turma.nome}
        aberto={renomeando}
        turma={turma}
        aoFechar={() => setRenomeando(false)}
        aoSalvar={(salva) => {
          setRenomeando(false)
          setTurma((atual) => ({ ...atual, nome: salva.nome }))
          setAviso('Nome da turma atualizado.')
        }}
      />

      <Modal
        aberto={excluindo}
        aoFechar={() => !apagando && setExcluindo(false)}
        sobretitulo="Turmas"
        titulo="Excluir turma?"
        largura={480}
        rodape={
          <>
            <BotaoPainel variante="contorno" onClick={() => setExcluindo(false)} disabled={apagando}>
              Cancelar
            </BotaoPainel>
            <BotaoPainel variante="perigo" onClick={confirmarExclusao} disabled={apagando}>
              {apagando ? 'Excluindo…' : 'Excluir turma'}
            </BotaoPainel>
          </>
        }
      >
        <p className={estilos.textoModal}>
          “{turma.nome}” será apagada e o código {turma.codigo} deixa de funcionar. Essa ação não pode ser desfeita.
        </p>
      </Modal>
    </>
  )
}

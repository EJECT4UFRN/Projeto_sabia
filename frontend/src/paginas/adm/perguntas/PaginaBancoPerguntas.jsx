import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Carregando from '../../../componentes/estados/Carregando'
import Alerta from '../../../componentes/formulario/Alerta'
import {
  IconeInterrogacao,
  IconeLapis,
  IconeLixeira,
  IconeLupa,
  IconeMaisCirculo,
} from '../../../componentes/icones/Icones'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import CabecalhoPagina from '../../../componentes/painel/CabecalhoPagina'
import Modal from '../../../componentes/painel/Modal'
import Paginacao from '../../../componentes/painel/Paginacao'
import Selecao from '../../../componentes/painel/Selecao'
import { DIFICULDADES } from '../../../componentes/painel/dificuldades'
import { Dificuldade, SeloCategoria, SeloStatus } from '../../../componentes/painel/Selos'
import { excluirPergunta, listarCategorias, listarPerguntas } from '../../../servicos/perguntas'
import { tempoRelativo } from '../../../utilitarios/tempoRelativo'
import estilos from './PaginaBancoPerguntas.module.css'

const POR_PAGINA = 10

function lerFiltros(parametros) {
  return {
    busca: parametros.get('busca') ?? '',
    categoria: parametros.get('categoria') ?? '',
    dificuldade: parametros.get('dificuldade') ?? '',
    pagina: Number(parametros.get('pagina')) || 1,
  }
}

export default function PaginaBancoPerguntas() {
  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)
  const local = useLocation()
  const navegar = useNavigate()

  const [rascunho, setRascunho] = useState(filtros)
  const [categorias, setCategorias] = useState([])
  // Cada combinação de filtros + "versão" (para recarregar) gera uma busca.
  // Enquanto a resposta não chega, a tabela anterior continua visível, esmaecida.
  const [versao, setVersao] = useState(0)
  const [carga, setCarga] = useState({ chave: null, resultado: null, erro: '' })
  const [aviso, setAviso] = useState(local.state?.aviso ?? '')
  const [paraExcluir, setParaExcluir] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState('')

  const chaveFiltros = parametros.toString()
  const chave = `${chaveFiltros}#${versao}`
  const carregando = carga.chave !== chave
  const resultado = carga.resultado
  const erro = carregando ? '' : carga.erro
  const recarregar = () => setVersao((v) => v + 1)

  useEffect(() => {
    let ativo = true
    const { busca, categoria, dificuldade, pagina } = lerFiltros(new URLSearchParams(chaveFiltros))
    listarPerguntas({ busca, categoria, dificuldade, pagina })
      .then((dados) => ativo && setCarga({ chave, resultado: dados, erro: '' }))
      .catch((falha) => {
        if (!ativo) return
        // Página que deixou de existir (ex.: após excluir o último item): volta para a primeira.
        if (falha.status === 404 && pagina > 1) {
          setParametros((atual) => {
            atual.delete('pagina')
            return atual
          })
          return
        }
        setCarga((anterior) => ({ ...anterior, chave, erro: falha.message }))
      })
    return () => {
      ativo = false
    }
  }, [chave, chaveFiltros, setParametros])

  useEffect(() => {
    listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]))
  }, [])

  // O aviso de "pergunta salva" vem da tela de edição; limpa o histórico para não reaparecer.
  useEffect(() => {
    if (local.state?.aviso) navegar(`${local.pathname}${local.search}`, { replace: true, state: null })
  }, [local, navegar])

  function aplicarFiltros(evento) {
    evento.preventDefault()
    const novos = new URLSearchParams()
    const busca = rascunho.busca.trim()
    if (busca) novos.set('busca', busca)
    if (rascunho.categoria) novos.set('categoria', rascunho.categoria)
    if (rascunho.dificuldade) novos.set('dificuldade', rascunho.dificuldade)
    setParametros(novos)
  }

  function limparFiltros() {
    setRascunho({ busca: '', categoria: '', dificuldade: '', pagina: 1 })
    setParametros(new URLSearchParams())
  }

  function irParaPagina(pagina) {
    setParametros((atual) => {
      if (pagina > 1) atual.set('pagina', pagina)
      else atual.delete('pagina')
      return atual
    })
  }

  async function confirmarExclusao() {
    setExcluindo(true)
    setErroExclusao('')
    try {
      await excluirPergunta(paraExcluir.id)
      setAviso('Pergunta excluída.')
      setParaExcluir(null)
      const sobrouNaPagina = resultado.results.length > 1
      if (!sobrouNaPagina && filtros.pagina > 1) irParaPagina(filtros.pagina - 1)
      else recarregar()
    } catch (falha) {
      setErroExclusao(falha.message)
    } finally {
      setExcluindo(false)
    }
  }

  const temFiltro = Boolean(filtros.busca || filtros.categoria || filtros.dificuldade)
  const total = resultado?.count ?? 0
  const perguntas = resultado?.results ?? []
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const primeiro = total ? (filtros.pagina - 1) * POR_PAGINA + 1 : 0
  const ultimo = total ? primeiro + perguntas.length - 1 : 0

  return (
    <>
      <CabecalhoPagina
        migalhas={[{ rotulo: 'Dashboard', para: '/adm' }, { rotulo: 'Banco de Perguntas' }]}
        titulo="Banco de Perguntas"
        descricao="Crie, edite e organize suas perguntas de quiz em diferentes matérias e níveis."
      >
        <BotaoPainel para="/adm/perguntas/nova" icone={<IconeMaisCirculo />} className={estilos.botaoAdicionar}>
          Adicionar pergunta
        </BotaoPainel>
      </CabecalhoPagina>

      {aviso && (
        <div className={estilos.aviso}>
          <Alerta tipo="sucesso">{aviso}</Alerta>
        </div>
      )}

      <form className={estilos.filtros} onSubmit={aplicarFiltros} role="search">
        <div className={`${estilos.campoFiltro} ${estilos.campoBusca}`}>
          <label htmlFor="filtro-busca" className={estilos.rotulo}>
            Busca rápida
          </label>
          <div className={estilos.busca}>
            <span className={estilos.lupa}>
              <IconeLupa />
            </span>
            <input
              id="filtro-busca"
              type="search"
              placeholder="Buscar pela pergunta ou categoria"
              value={rascunho.busca}
              onChange={(e) => setRascunho((r) => ({ ...r, busca: e.target.value }))}
            />
          </div>
        </div>

        <div className={estilos.campoFiltro}>
          <label htmlFor="filtro-categoria" className={estilos.rotulo}>
            Categoria
          </label>
          <Selecao
            id="filtro-categoria"
            compacto
            value={rascunho.categoria}
            onChange={(e) => setRascunho((r) => ({ ...r, categoria: e.target.value }))}
          >
            <option value="">Todas as categorias</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </Selecao>
        </div>

        <div className={`${estilos.campoFiltro} ${estilos.campoNivel}`}>
          <label htmlFor="filtro-nivel" className={estilos.rotulo}>
            Nível
          </label>
          <Selecao
            id="filtro-nivel"
            compacto
            value={rascunho.dificuldade}
            onChange={(e) => setRascunho((r) => ({ ...r, dificuldade: e.target.value }))}
          >
            <option value="">Todas</option>
            {DIFICULDADES.map(({ valor, rotulo }) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
        </div>

        <BotaoPainel type="submit" variante="escuro" className={estilos.botaoFiltrar}>
          Filtrar
        </BotaoPainel>
      </form>

      <section className={estilos.tabelaCartao} aria-label="Perguntas" aria-busy={carregando}>
        {erro ? (
          <div className={estilos.estado}>
            <Alerta>{erro}</Alerta>
            <BotaoPainel variante="contorno" onClick={recarregar}>
              Tentar de novo
            </BotaoPainel>
          </div>
        ) : carregando && !resultado ? (
          <Carregando texto="Carregando perguntas…" />
        ) : perguntas.length === 0 ? (
          <div className={estilos.estado}>
            {temFiltro ? (
              <>
                <p className={estilos.estadoTitulo}>Nenhuma pergunta encontrada</p>
                <p className={estilos.estadoTexto}>Tente outra busca ou mude os filtros.</p>
                <BotaoPainel variante="contorno" onClick={limparFiltros}>
                  Limpar filtros
                </BotaoPainel>
              </>
            ) : (
              <>
                <p className={estilos.estadoTitulo}>Seu banco de perguntas está vazio</p>
                <p className={estilos.estadoTexto}>
                  Crie a primeira pergunta para começar a montar seus quizzes.
                </p>
                <BotaoPainel para="/adm/perguntas/nova" icone={<IconeMaisCirculo />}>
                  Adicionar pergunta
                </BotaoPainel>
              </>
            )}
          </div>
        ) : (
          <>
            <table className={`${estilos.tabela} ${carregando ? estilos.atualizando : ''}`}>
              <thead>
                <tr>
                  <th scope="col" className={estilos.colunaPergunta}>
                    Pergunta
                  </th>
                  <th scope="col" className={estilos.soDesktop}>
                    Categoria
                  </th>
                  <th scope="col" className={estilos.soDesktop}>
                    Dificuldade
                  </th>
                  <th scope="col" className={estilos.soDesktop}>
                    Status
                  </th>
                  <th scope="col" className={estilos.colunaAcoes}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {perguntas.map((pergunta) => (
                  <tr key={pergunta.id}>
                    <td className={estilos.colunaPergunta}>
                      <div className={estilos.pergunta}>
                        <span className={estilos.iconePergunta} aria-hidden="true">
                          <IconeInterrogacao />
                        </span>
                        <div className={estilos.textosPergunta}>
                          <span className={estilos.textoPergunta} title={pergunta.texto}>
                            {pergunta.texto}
                          </span>
                          <span className={estilos.quando}>{tempoRelativo(pergunta.atualizada_em)}</span>
                        </div>
                      </div>
                    </td>
                    <td className={estilos.soDesktop}>
                      {pergunta.categoria_nome ? (
                        <SeloCategoria>{pergunta.categoria_nome}</SeloCategoria>
                      ) : (
                        <span className={estilos.semCategoria}>Sem categoria</span>
                      )}
                    </td>
                    <td className={estilos.soDesktop}>
                      <Dificuldade valor={pergunta.dificuldade} />
                    </td>
                    <td className={estilos.soDesktop}>
                      <SeloStatus ativa={pergunta.ativa} />
                    </td>
                    <td className={estilos.colunaAcoes}>
                      <div className={estilos.acoes}>
                        <Link
                          to={`/adm/perguntas/${pergunta.id}/editar`}
                          className={estilos.acao}
                          aria-label={`Editar: ${pergunta.texto}`}
                        >
                          <IconeLapis />
                        </Link>
                        <button
                          type="button"
                          className={`${estilos.acao} ${estilos.acaoExcluir}`}
                          aria-label={`Excluir: ${pergunta.texto}`}
                          onClick={() => {
                            setErroExclusao('')
                            setParaExcluir(pergunta)
                          }}
                        >
                          <IconeLixeira />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <footer className={`${estilos.rodape} ${totalPaginas <= 1 ? estilos.rodapeSemPaginas : ''}`}>
              <p className={estilos.contagem}>
                Exibindo{' '}
                <strong className={estilos.intervalo}>
                  {primeiro}–{ultimo}
                </strong>{' '}
                de <strong>{total}</strong> {total === 1 ? 'pergunta' : 'perguntas'}
              </p>
              <Paginacao pagina={filtros.pagina} totalPaginas={totalPaginas} aoMudar={irParaPagina} />
            </footer>
          </>
        )}
      </section>

      <Modal
        aberto={Boolean(paraExcluir)}
        aoFechar={() => !excluindo && setParaExcluir(null)}
        sobretitulo="Banco de perguntas"
        titulo="Excluir pergunta?"
        largura={480}
        rodape={
          <>
            <BotaoPainel variante="contorno" onClick={() => setParaExcluir(null)} disabled={excluindo}>
              Cancelar
            </BotaoPainel>
            <BotaoPainel variante="perigo" onClick={confirmarExclusao} disabled={excluindo}>
              {excluindo ? 'Excluindo…' : 'Excluir pergunta'}
            </BotaoPainel>
          </>
        }
      >
        <p className={estilos.textoModal}>
          “{paraExcluir?.texto}” será apagada do seu banco. Essa ação não pode ser desfeita.
        </p>
        <p className={estilos.dicaModal}>
          Se quiser só tirá-la de uso, edite a pergunta e desmarque <strong>Pergunta ativa</strong>.
        </p>
        <Alerta>{erroExclusao}</Alerta>
      </Modal>
    </>
  )
}

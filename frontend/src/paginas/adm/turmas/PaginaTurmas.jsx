import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Carregando from '../../../componentes/estados/Carregando'
import Alerta from '../../../componentes/formulario/Alerta'
import { IconeMaisCirculo, IconeTurmas } from '../../../componentes/icones/Icones'
import BotaoPainel from '../../../componentes/painel/BotaoPainel'
import CabecalhoPagina from '../../../componentes/painel/CabecalhoPagina'
import { listarTurmas } from '../../../servicos/escola'
import ModalNomeTurma from './ModalNomeTurma'
import estilos from './Turmas.module.css'

/** Lista de turmas do professor (tela nova: o mockup não tem). */
export default function PaginaTurmas() {
  const local = useLocation()
  const navegar = useNavigate()
  const [versao, setVersao] = useState(0)
  const [carga, setCarga] = useState({ versao: null, turmas: null, erro: '' })
  const [aviso] = useState(local.state?.aviso ?? '')
  const [criando, setCriando] = useState(false)

  const carregando = carga.versao !== versao
  const turmas = carga.turmas ?? []

  useEffect(() => {
    let ativo = true
    listarTurmas()
      .then((dados) => ativo && setCarga({ versao, turmas: dados, erro: '' }))
      .catch((falha) => ativo && setCarga({ versao, turmas: null, erro: falha.message }))
    return () => {
      ativo = false
    }
  }, [versao])

  useEffect(() => {
    if (local.state?.aviso) navegar(local.pathname, { replace: true, state: null })
  }, [local, navegar])

  return (
    <>
      <CabecalhoPagina
        migalhas={[{ rotulo: 'Dashboard', para: '/adm' }, { rotulo: 'Turmas' }]}
        titulo="Turmas"
        descricao="Organize seus alunos para liberar materiais só para eles."
      >
        <BotaoPainel icone={<IconeMaisCirculo />} className={estilos.botaoNovo} onClick={() => setCriando(true)}>
          Nova turma
        </BotaoPainel>
      </CabecalhoPagina>

      {aviso && (
        <div className={estilos.aviso}>
          <Alerta tipo="sucesso">{aviso}</Alerta>
        </div>
      )}

      <section aria-label="Suas turmas" aria-busy={carregando}>
        {carga.erro && !carregando ? (
          <div className={estilos.estado}>
            <Alerta>{carga.erro}</Alerta>
            <BotaoPainel variante="contorno" onClick={() => setVersao((v) => v + 1)}>
              Tentar de novo
            </BotaoPainel>
          </div>
        ) : carregando && !carga.turmas ? (
          <Carregando texto="Carregando turmas…" />
        ) : turmas.length === 0 ? (
          <div className={estilos.estado}>
            <span className={estilos.iconeVazio}>
              <IconeTurmas width="40" height="46" />
            </span>
            <h2 className={estilos.estadoTitulo}>Você ainda não tem turmas</h2>
            <p className={estilos.estadoTexto}>
              Crie uma turma, adicione seus alunos ou passe o código para eles entrarem pelo perfil.
            </p>
            <BotaoPainel icone={<IconeMaisCirculo />} onClick={() => setCriando(true)}>
              Nova turma
            </BotaoPainel>
          </div>
        ) : (
          <ul className={estilos.grade}>
            {turmas.map((turma) => (
              <li key={turma.id}>
                <Link to={`/adm/turmas/${turma.id}`} className={estilos.cartaoTurma}>
                  <span className={estilos.iconeTurma}>
                    <IconeTurmas />
                  </span>
                  <span className={estilos.textosTurma}>
                    <span className={estilos.nomeTurma}>{turma.nome}</span>
                    <span className={estilos.detalheTurma}>
                      {turma.alunos_total} {turma.alunos_total === 1 ? 'aluno' : 'alunos'} · código{' '}
                      <strong>{turma.codigo}</strong>
                    </span>
                  </span>
                  <span className={estilos.gerenciar}>Gerenciar</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ModalNomeTurma
        aberto={criando}
        aoFechar={() => setCriando(false)}
        aoSalvar={(turma) => navegar(`/adm/turmas/${turma.id}`, { state: { aviso: `Turma “${turma.nome}” criada.` } })}
      />
    </>
  )
}

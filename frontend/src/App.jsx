import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LayoutAdm from './componentes/layout/LayoutAdm'
import LayoutEstudante from './componentes/layout/LayoutEstudante'
import PaginaCriarConta from './paginas/autenticacao/PaginaCriarConta'
import PaginaEntrar from './paginas/autenticacao/PaginaEntrar'
import PaginaEsqueciSenha from './paginas/autenticacao/PaginaEsqueciSenha'
import PaginaRedefinirSenha from './paginas/autenticacao/PaginaRedefinirSenha'
import PaginaBancoPerguntas from './paginas/adm/perguntas/PaginaBancoPerguntas'
import PaginaEditorPergunta from './paginas/adm/perguntas/PaginaEditorPergunta'
import PaginaEditorQuiz from './paginas/adm/quizzes/PaginaEditorQuiz'
import PaginaMeusJogos from './paginas/adm/quizzes/PaginaMeusJogos'
import PaginaAbrirSala from './paginas/partida/PaginaAbrirSala'
import PaginaEntrarPin from './paginas/partida/PaginaEntrarPin'
import PaginaJogo from './paginas/partida/PaginaJogo'
import PaginaTelao from './paginas/partida/PaginaTelao'
import PaginaHistorico from './paginas/estudante/PaginaHistorico'
import PaginaPerfil from './paginas/estudante/PaginaPerfil'
import PaginaResumoPartida from './paginas/estudante/PaginaResumoPartida'
import PaginaEditorMaterial from './paginas/adm/materiais/PaginaEditorMaterial'
import PaginaMateriais from './paginas/adm/materiais/PaginaMateriais'
import PaginaTurma from './paginas/adm/turmas/PaginaTurma'
import PaginaTurmas from './paginas/adm/turmas/PaginaTurmas'
import PaginaDashboard from './paginas/adm/painel/PaginaDashboard'
import PaginaPartidas from './paginas/adm/painel/PaginaPartidas'
import PaginaRelatorio from './paginas/adm/painel/PaginaRelatorio'
import PaginaProjeto from './paginas/institucional/PaginaProjeto'
import PaginaComoFunciona from './paginas/institucional/PaginaComoFunciona'
import PaginaContinueAprendendo from './paginas/materiais/PaginaContinueAprendendo'
import PaginaMaterial from './paginas/materiais/PaginaMaterial'
import ProvedorSessao from './sessao/ProvedorSessao'
import RotaProtegida from './sessao/RotaProtegida'

export function Rotas() {
  return (
    <Routes>
      {/* Telas de entrar: ocupam a largura toda no desktop */}
      <Route element={<LayoutEstudante telaCheia />}>
        <Route path="/entrar" element={<PaginaEntrar perfil="estudante" />} />
        <Route path="/professor/entrar" element={<PaginaEntrar perfil="professor" />} />
      </Route>

      {/* Página inicial ("O projeto"): ocupa a largura toda, com o rodapé próprio */}
      <Route element={<LayoutEstudante telaCheia />}>
        <Route path="/" element={<PaginaProjeto />} />
        <Route path="/o-projeto" element={<PaginaProjeto />} />
      </Route>

      {/* Área pública (sem barra inferior) */}
      <Route element={<LayoutEstudante />}>
        <Route path="/criar-conta" element={<PaginaCriarConta perfil="estudante" />} />
        <Route path="/professor/criar-conta" element={<PaginaCriarConta perfil="professor" />} />
        <Route path="/esqueci-senha" element={<PaginaEsqueciSenha />} />
        <Route path="/redefinir-senha/:uid/:token" element={<PaginaRedefinirSenha />} />
        <Route path="/entrar-pin" element={<PaginaEntrarPin />} />
        <Route path="/como-funciona" element={<PaginaComoFunciona />} />
      </Route>

      {/* Área de quem está logado (com barra inferior no mobile) */}
      <Route element={<RotaProtegida />}>
        <Route element={<LayoutEstudante comBarraInferior />}>
          <Route path="/jogar" element={<Navigate to="/entrar-pin" replace />} />
          <Route path="/historico" element={<PaginaHistorico />} />
          <Route path="/historico/:id" element={<PaginaResumoPartida />} />
          <Route path="/perfil" element={<PaginaPerfil />} />
        </Route>
      </Route>

      {/* Materiais: abertos a visitantes (só os públicos); barra inferior para quem está logado */}
      <Route element={<LayoutEstudante comBarraInferior="seLogado" />}>
        <Route path="/materiais" element={<PaginaContinueAprendendo />} />
        <Route path="/materiais/:id" element={<PaginaMaterial />} />
      </Route>

      {/* Partida ao vivo: telas cheias, sem menu */}
      <Route path="/jogo/:pin" element={<PaginaJogo />} />
      <Route element={<RotaProtegida perfil="professor" telaDeEntrar="/professor/entrar" />}>
        <Route path="/adm/partidas/:id" element={<PaginaTelao />} />
      </Route>

      {/* Painel do professor */}
      <Route element={<RotaProtegida perfil="professor" telaDeEntrar="/professor/entrar" />}>
        <Route path="/adm" element={<LayoutAdm />}>
          <Route index element={<PaginaDashboard />} />
          <Route path="partidas" element={<PaginaPartidas />} />
          <Route path="partidas/:id/relatorio" element={<PaginaRelatorio />} />
          <Route path="perguntas" element={<PaginaBancoPerguntas />} />
          <Route path="perguntas/nova" element={<PaginaEditorPergunta />} />
          <Route path="perguntas/:id/editar" element={<PaginaEditorPergunta />} />
          <Route path="quiz" element={<PaginaMeusJogos />} />
          <Route path="quiz/novo" element={<PaginaEditorQuiz />} />
          <Route path="quiz/:id/editar" element={<PaginaEditorQuiz />} />
          <Route path="quiz/:id/partida" element={<PaginaAbrirSala />} />
          <Route path="materiais" element={<PaginaMateriais />} />
          <Route path="materiais/novo" element={<PaginaEditorMaterial />} />
          <Route path="materiais/:id/editar" element={<PaginaEditorMaterial />} />
          <Route path="turmas" element={<PaginaTurmas />} />
          <Route path="turmas/:id" element={<PaginaTurma />} />
          <Route path="perfil" element={<PaginaPerfil noPainel />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ProvedorSessao>
        <Rotas />
      </ProvedorSessao>
    </BrowserRouter>
  )
}

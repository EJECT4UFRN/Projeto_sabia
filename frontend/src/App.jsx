import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LayoutAdm from './componentes/layout/LayoutAdm'
import LayoutEstudante from './componentes/layout/LayoutEstudante'
import PaginaCriarConta from './paginas/autenticacao/PaginaCriarConta'
import PaginaEntrar from './paginas/autenticacao/PaginaEntrar'
import PaginaEsqueciSenha from './paginas/autenticacao/PaginaEsqueciSenha'
import PaginaRedefinirSenha from './paginas/autenticacao/PaginaRedefinirSenha'
import PaginaBancoPerguntas from './paginas/adm/perguntas/PaginaBancoPerguntas'
import PaginaEditorPergunta from './paginas/adm/perguntas/PaginaEditorPergunta'
import EmConstrucao from './paginas/EmConstrucao'
import PaginaEditorQuiz from './paginas/adm/quizzes/PaginaEditorQuiz'
import PaginaMeusJogos from './paginas/adm/quizzes/PaginaMeusJogos'
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

      {/* Área pública (sem barra inferior) */}
      <Route element={<LayoutEstudante />}>
        <Route path="/" element={<Navigate to="/entrar" replace />} />
        <Route path="/criar-conta" element={<PaginaCriarConta perfil="estudante" />} />
        <Route path="/professor/criar-conta" element={<PaginaCriarConta perfil="professor" />} />
        <Route path="/esqueci-senha" element={<PaginaEsqueciSenha />} />
        <Route path="/redefinir-senha/:uid/:token" element={<PaginaRedefinirSenha />} />
        <Route path="/entrar-pin" element={<EmConstrucao titulo="Entre no jogo. Digite o PIN." />} />
        <Route path="/como-funciona" element={<EmConstrucao titulo="Como funciona" />} />
        <Route path="/o-projeto" element={<EmConstrucao titulo="O projeto" />} />
      </Route>

      {/* Área de quem está logado (com barra inferior no mobile) */}
      <Route element={<RotaProtegida />}>
        <Route element={<LayoutEstudante comBarraInferior />}>
          <Route path="/jogar" element={<EmConstrucao titulo="Jogar" />} />
          <Route path="/historico" element={<EmConstrucao titulo="Meu histórico" />} />
          <Route path="/perfil" element={<EmConstrucao titulo="Perfil" />} />
          <Route path="/materiais" element={<EmConstrucao titulo="Continue aprendendo" />} />
        </Route>
      </Route>

      {/* Painel do professor */}
      <Route element={<RotaProtegida perfil="professor" telaDeEntrar="/professor/entrar" />}>
        <Route path="/adm" element={<LayoutAdm />}>
          <Route index element={<EmConstrucao titulo="Dashboard" />} />
          <Route path="perguntas" element={<PaginaBancoPerguntas />} />
          <Route path="perguntas/nova" element={<PaginaEditorPergunta />} />
          <Route path="perguntas/:id/editar" element={<PaginaEditorPergunta />} />
          <Route path="quiz" element={<PaginaMeusJogos />} />
          <Route path="quiz/novo" element={<PaginaEditorQuiz />} />
          <Route path="quiz/:id/editar" element={<PaginaEditorQuiz />} />
          <Route path="quiz/:id/partida" element={<EmConstrucao titulo="Sala da partida" />} />
          <Route path="materiais" element={<EmConstrucao titulo="Materiais de estudo" />} />
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

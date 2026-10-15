import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LayoutAdm from './componentes/layout/LayoutAdm'
import LayoutEstudante from './componentes/layout/LayoutEstudante'
import EmConstrucao from './paginas/EmConstrucao'

export function Rotas() {
  return (
    <Routes>
      {/* Área pública do estudante (sem barra inferior) */}
      <Route element={<LayoutEstudante />}>
        <Route path="/" element={<Navigate to="/entrar" replace />} />
        <Route path="/entrar" element={<EmConstrucao titulo="Entrar na conta" />} />
        <Route path="/criar-conta" element={<EmConstrucao titulo="Criar minha conta" />} />
        <Route path="/entrar-pin" element={<EmConstrucao titulo="Entre no jogo. Digite o PIN." />} />
        <Route path="/como-funciona" element={<EmConstrucao titulo="Como funciona" />} />
        <Route path="/o-projeto" element={<EmConstrucao titulo="O projeto" />} />
      </Route>

      {/* Área do estudante logado (com barra inferior no mobile) */}
      <Route element={<LayoutEstudante comBarraInferior />}>
        <Route path="/jogar" element={<EmConstrucao titulo="Jogar" />} />
        <Route path="/historico" element={<EmConstrucao titulo="Meu histórico" />} />
        <Route path="/perfil" element={<EmConstrucao titulo="Perfil" />} />
        <Route path="/materiais" element={<EmConstrucao titulo="Continue aprendendo" />} />
      </Route>

      {/* Painel do professor */}
      <Route path="/adm" element={<LayoutAdm />}>
        <Route index element={<EmConstrucao titulo="Dashboard" />} />
        <Route path="perguntas" element={<EmConstrucao titulo="Banco de perguntas" />} />
        <Route path="quiz" element={<EmConstrucao titulo="Meus jogos" />} />
        <Route path="materiais" element={<EmConstrucao titulo="Materiais de estudo" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Rotas />
    </BrowserRouter>
  )
}

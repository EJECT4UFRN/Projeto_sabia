// Textos que mudam entre a área do estudante e a do professor.
// As telas do professor não existem no mockup: seguem o visual das do estudante.

export const TEXTOS = {
  estudante: {
    painelTitulo: 'Sua jornada continua aqui.',
    painelTexto: 'Acesse seus materiais, acompanhe seu histórico e entre nas partidas da sua turma.',
    sobretitulo: 'ÁREA DO ESTUDANTE',
    tituloEntrar: 'Entrar na conta',
    subtituloEntrar: 'Use seus dados para acessar o Sabiá.',
    rotaEntrar: '/entrar',
    rotaCriarConta: '/criar-conta',
    sobretituloCadastro: 'BEM-VINDO AO SABIÁ',
    botaoCadastro: 'Criar conta e jogar',
    destinoAposCadastro: '/entrar-pin',
    trocaDeArea: { pergunta: 'Administrador?', rotulo: 'Painel administrativo', destino: '/professor/entrar' },
  },
  professor: {
    painelTitulo: 'Sua turma te espera.',
    painelTexto: 'Crie quizzes, conduza partidas ao vivo e compartilhe materiais com seus alunos.',
    sobretitulo: 'ÁREA DO PROFESSOR',
    tituloEntrar: 'Entrar no painel',
    subtituloEntrar: 'Use seus dados para acessar o painel do Sabiá.',
    rotaEntrar: '/professor/entrar',
    rotaCriarConta: '/professor/criar-conta',
    sobretituloCadastro: 'PAINEL DO PROFESSOR',
    botaoCadastro: 'Criar conta de professor',
    destinoAposCadastro: '/adm',
    trocaDeArea: { pergunta: 'Estudante?', rotulo: 'Área do estudante', destino: '/entrar' },
  },
}

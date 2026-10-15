// Indicador de força da senha da tela "Criar minha conta".
// O mockup mostra só o estado "Boa"; as outras faixas foram inferidas.
// É uma ajuda visual: quem decide se a senha é aceita é o backend.

export const NIVEIS = [
  { nivel: 0, rotulo: '', percentual: 0, cor: 'transparent' },
  { nivel: 1, rotulo: 'Fraca', percentual: 25, cor: 'var(--cor-erro)' },
  { nivel: 2, rotulo: 'Média', percentual: 50, cor: 'var(--cor-amarelo-secundario)' },
  { nivel: 3, rotulo: 'Boa', percentual: 80, cor: '#2f9e44' },
  { nivel: 4, rotulo: 'Forte', percentual: 100, cor: '#2f9e44' },
]

export function avaliarSenha(senha) {
  if (!senha) return NIVEIS[0]
  if (senha.length < 8 || /^\d+$/.test(senha)) return NIVEIS[1]

  const criterios = [
    /[a-z]/.test(senha) && /[A-Z]/.test(senha),
    /\d/.test(senha),
    /[^A-Za-z0-9]/.test(senha),
    senha.length >= 12,
  ]
  const pontos = criterios.filter(Boolean).length

  if (pontos <= 1) return NIVEIS[2]
  if (pontos <= 3) return NIVEIS[3]
  return NIVEIS[4]
}

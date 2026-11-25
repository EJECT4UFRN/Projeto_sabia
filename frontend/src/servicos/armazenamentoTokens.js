// Onde os tokens ficam guardados:
// - "Manter minha conta conectada" marcado → localStorage (sobrevive a fechar o navegador)
// - desmarcado → sessionStorage (some ao fechar a aba)

const CHAVE = 'sabia.tokens'

function ler(armazenamento) {
  try {
    const bruto = armazenamento.getItem(CHAVE)
    return bruto ? JSON.parse(bruto) : null
  } catch {
    return null
  }
}

export function obterTokens() {
  return ler(sessionStorage) ?? ler(localStorage)
}

export function salvarTokens({ access, refresh }, manterConectado) {
  limparTokens()
  const destino = manterConectado ? localStorage : sessionStorage
  try {
    destino.setItem(CHAVE, JSON.stringify({ access, refresh, manterConectado: Boolean(manterConectado) }))
  } catch {
    // armazenamento indisponível (modo privado restrito): a sessão vale só enquanto a página estiver aberta
  }
}

export function atualizarTokens(novos) {
  const atuais = obterTokens()
  if (!atuais) return
  salvarTokens({ ...atuais, ...novos }, atuais.manterConectado)
}

export function limparTokens() {
  try {
    localStorage.removeItem(CHAVE)
    sessionStorage.removeItem(CHAVE)
  } catch {
    // nada a fazer
  }
}

// Endereço base da API (veja `.env.example`).
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

// Exemplo: const status = await api("/status/");
export async function api(caminho, opcoes = {}) {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: { "Content-Type": "application/json", ...opcoes.headers },
  });
  if (!resposta.ok) throw new Error(`Erro ${resposta.status} em ${caminho}`);
  return resposta.status === 204 ? null : resposta.json();
}

import { afterEach, expect, test, vi } from 'vitest'
import { enderecoDaPartida } from './partidas'

afterEach(() => vi.unstubAllEnvs())

test('em produção, a partida conecta no endereço da API', () => {
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.com/api')
  expect(enderecoDaPartida('123456', { chave: 'abc' })).toBe('wss://api.exemplo.com/ws/partidas/123456/?chave=abc')
})

test('sem VITE_API_URL ou com caminho relativo, conecta no próprio site', () => {
  vi.stubEnv('VITE_API_URL', '/api')
  expect(enderecoDaPartida('123456', { chave: 'abc' })).toBe(
    `ws://${window.location.host}/ws/partidas/123456/?chave=abc`,
  )
})

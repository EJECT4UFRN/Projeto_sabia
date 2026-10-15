import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Dentro do Docker o backend responde pelo nome do serviço.
    proxy: {
      '/api': process.env.VITE_PROXY_API ?? 'http://localhost:8000',
      '/ws': { target: process.env.VITE_PROXY_WS ?? 'ws://localhost:8000', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/testes/configuracao.js',
    // Sem aplicar CSS nos testes: as media queries do jsdom esconderiam a versão mobile ou a desktop.
    css: false,
  },
})

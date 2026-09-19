import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Libera túneis do ngrok (o subdomínio muda a cada sessão)
    allowedHosts: ['.ngrok-free.app'],
    // Em dev a API roda à parte (bun run dev:api); em produção o próprio server serve o front
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
})

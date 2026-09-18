import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Libera túneis do ngrok (o subdomínio muda a cada sessão)
    allowedHosts: ['.ngrok-free.app'],
  },
})

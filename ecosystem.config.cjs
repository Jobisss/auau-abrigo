/**
 * PM2 na VPS: `pm2 start ecosystem.config.cjs`
 * PORT, ADMIN_* e VITE_PIX_* ficam no .env ao lado deste arquivo (o Bun lê sozinho).
 * Não defina PORT aqui: o que o PM2 passa tem prioridade sobre o .env.
 */
module.exports = {
  apps: [
    {
      name: 'auau-abrigo',
      script: 'server/index.ts',
      // Se o PM2 não achar o bun, troque pelo caminho completo (saída de `which bun`)
      interpreter: 'bun',
      // data/, dist/ e .env são lidos a partir daqui
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        // O nginx na frente repassa o IP real do visitante (X-Forwarded-For)
        TRUST_PROXY: 'true',
      },
      max_memory_restart: '300M',
      time: true,
    },
  ],
}

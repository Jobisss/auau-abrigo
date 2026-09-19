#!/usr/bin/env bash
# Atualiza a VPS: puxa o código, instala, builda e reinicia no PM2.
# Uso (de qualquer pasta):  ./deploy/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="auau-abrigo"
cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "✗ falta o .env em $APP_DIR (copie do .env.example e preencha)" >&2
  exit 1
fi

echo "→ git pull"
git pull --ff-only

echo "→ bun install"
bun install --frozen-lockfile

# Se o build falhar, o set -e para aqui e o app que já está no ar continua rodando
echo "→ bun run build"
bun run build

if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  echo "→ pm2 restart"
  pm2 restart "$APP_NAME" --update-env
else
  echo "→ pm2 start (primeira vez)"
  pm2 start ecosystem.config.cjs
fi
pm2 save > /dev/null

echo "✓ deploy ok — $(git log -1 --format='%h %s')"

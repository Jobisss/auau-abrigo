#!/usr/bin/env bash
# Backup de data/ (banco + fotos). Guarda os últimos 14.
# Cron diário às 3h:  0 3 * * * /caminho/auau-abrigo/deploy/backup.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${BACKUP_DIR:-$HOME/backups/auau-abrigo}"
STAMP="$(date +%Y-%m-%d_%H%M)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DEST"
# Cópia consistente do SQLite mesmo com o app rodando (VACUUM INTO não trava as escritas)
bun -e "import { Database } from 'bun:sqlite'; new Database('$APP_DIR/data/abrigo.db').run(\"VACUUM INTO '$TMP/abrigo.db'\")"
tar -czf "$DEST/data_$STAMP.tar.gz" -C "$TMP" abrigo.db -C "$APP_DIR/data" uploads

ls -1t "$DEST"/data_*.tar.gz | tail -n +15 | xargs -r rm --
echo "backup ok: $DEST/data_$STAMP.tar.gz"

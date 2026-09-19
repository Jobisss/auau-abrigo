import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// O Bun já carrega o .env sozinho.
const env = process.env

export const PORT = Number(env.PORT) || 3001
export const IS_PROD = env.NODE_ENV === 'production'

/**
 * Tudo que precisa sobreviver a um deploy (banco + fotos) mora nesta pasta.
 * É ela que vai pro backup e que vira volume persistente no servidor.
 */
export const DATA_DIR = resolve(env.DATA_DIR || 'data')
export const UPLOADS_DIR = resolve(DATA_DIR, 'uploads')
export const DB_PATH = resolve(DATA_DIR, 'abrigo.db')
export const DIST_DIR = resolve('dist')

export const ADMIN_EMAIL = (env.ADMIN_EMAIL ?? '').trim().toLowerCase()
export const ADMIN_PASSWORD = env.ADMIN_PASSWORD ?? ''
export const ADMIN_ENABLED = ADMIN_EMAIL.length > 0 && ADMIN_PASSWORD.length >= 8

/** Atrás de proxy (Railway, Fly, nginx) o IP real do visitante vem no X-Forwarded-For. */
export const TRUST_PROXY = env.TRUST_PROXY === 'true'

mkdirSync(UPLOADS_DIR, { recursive: true })

if (!ADMIN_ENABLED) {
  console.warn('[auth] ADMIN_EMAIL/ADMIN_PASSWORD ausentes (senha precisa de 8+ caracteres) — login do painel desativado')
}

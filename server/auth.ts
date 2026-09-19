import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Cookie } from 'elysia'
import { ADMIN_EMAIL, ADMIN_ENABLED, ADMIN_PASSWORD, IS_PROD } from './config.ts'
import { db } from './db.ts'
import { HttpError } from './errors.ts'

/**
 * Um único login do abrigo, definido no .env do servidor (ADMIN_EMAIL / ADMIN_PASSWORD).
 * A sessão é um token aleatório guardado no SQLite e num cookie httpOnly —
 * o JavaScript da página nunca enxerga o token, e dá pra derrubar sessões apagando a tabela.
 */

export const SESSION_COOKIE = 'abrigo_sid'
const SESSION_MS = 7 * 86_400_000

type SessionCookie = Cookie<unknown>

const tokenOf = (cookie: SessionCookie) => (typeof cookie.value === 'string' ? cookie.value : '')

const digest = (s: string) => createHash('sha256').update(s).digest()
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b))

export function checkCredentials(email: string, password: string) {
  if (!ADMIN_ENABLED) return false
  // Avalia os dois sempre, pra não vazar pelo tempo de resposta qual deles errou
  const okEmail = same(email.trim().toLowerCase(), ADMIN_EMAIL)
  const okPassword = same(password, ADMIN_PASSWORD)
  return okEmail && okPassword
}

export function startSession(cookie: SessionCookie) {
  const token = randomBytes(32).toString('base64url')
  const expires = Date.now() + SESSION_MS
  db.query('DELETE FROM sessions WHERE expires_at < ?').run(Date.now())
  db.query('INSERT INTO sessions (token, expires_at) VALUES (?, ?)').run(token, expires)
  cookie.set({
    value: token,
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/api',
    expires: new Date(expires),
  })
}

export function endSession(cookie: SessionCookie) {
  const token = tokenOf(cookie)
  if (token) db.query('DELETE FROM sessions WHERE token = ?').run(token)
  cookie.set({ value: '', path: '/api', expires: new Date(0) })
}

export function isAdmin(cookie: SessionCookie) {
  const token = tokenOf(cookie)
  if (!token) return false
  const row = db.query<{ expires_at: number }, [string]>('SELECT expires_at FROM sessions WHERE token = ?').get(token)
  return Boolean(row && row.expires_at > Date.now())
}

export function requireAdmin(cookie: SessionCookie) {
  if (!isAdmin(cookie)) throw new HttpError(401, 'Faça login no painel')
}

/** Freio contra chute de senha: 5 erros por IP a cada 15 min. */
const attempts = new Map<string, { fails: number; resetAt: number }>()
const MAX_FAILS = 5
const WINDOW_MS = 15 * 60_000

export function guardLogin(ip: string) {
  const now = Date.now()
  const entry = attempts.get(ip)
  const live = entry && entry.resetAt > now ? entry : undefined
  if (live && live.fails >= MAX_FAILS) {
    throw new HttpError(429, 'Muitas tentativas — espere uns minutos e tente de novo')
  }
  return {
    fail() {
      const current = live ?? { fails: 0, resetAt: now + WINDOW_MS }
      current.fails++
      attempts.set(ip, current)
    },
    succeed() {
      attempts.delete(ip)
    },
  }
}

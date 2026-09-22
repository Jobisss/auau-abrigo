import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Cookie } from 'elysia'
import { ADMIN_EMAIL, ADMIN_ENABLED, ADMIN_PASSWORD, IS_PROD, TRUST_PROXY } from './config.ts'
import { db } from './db.ts'
import { HttpError } from './errors.ts'

/**
 * Um único login do abrigo, definido no .env do servidor (ADMIN_EMAIL / ADMIN_PASSWORD).
 * A sessão é um token aleatório num cookie httpOnly — o JavaScript da página nunca enxerga o token.
 * O banco guarda só o sha256 do token: backup vazado não vira sessão válida.
 * Trocar a senha no .env (e reiniciar) derruba todas as sessões abertas.
 */

export const SESSION_COOKIE = 'abrigo_sid'
const SESSION_MS = 7 * 86_400_000

type SessionCookie = Cookie<unknown>

const tokenOf = (cookie: SessionCookie) => (typeof cookie.value === 'string' ? cookie.value : '')

/** Hash de token aleatório (sessão, editToken) — é isso que vai pro banco, nunca o token cru. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

const digest = (s: string) => createHash('sha256').update(s).digest()
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b))

/** Se o e-mail/senha do .env mudou desde a última vez, ninguém continua logado com a credencial antiga. */
function resetSessionsIfCredentialsChanged() {
  if (!ADMIN_ENABLED) {
    db.exec('DELETE FROM sessions')
    return
  }
  const secret = `${ADMIN_EMAIL}\n${ADMIN_PASSWORD}`
  const row = db.query<{ value: string }, [string]>('SELECT value FROM meta WHERE key = ?').get('admin_credentials')
  if (row && Bun.password.verifySync(secret, row.value)) return
  db.exec('DELETE FROM sessions')
  db.query('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('admin_credentials', Bun.password.hashSync(secret))
  if (row) console.log('[auth] credenciais do painel mudaram — sessões antigas encerradas')
}
resetSessionsIfCredentialsChanged()

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
  db.query('INSERT INTO sessions (token, expires_at) VALUES (?, ?)').run(hashToken(token), expires)
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
  if (token) db.query('DELETE FROM sessions WHERE token = ?').run(hashToken(token))
  cookie.set({ value: '', path: '/api', expires: new Date(0) })
}

export function isAdmin(cookie: SessionCookie) {
  const token = tokenOf(cookie)
  if (!ADMIN_ENABLED || !token) return false
  const row = db
    .query<{ expires_at: number }, [string]>('SELECT expires_at FROM sessions WHERE token = ?')
    .get(hashToken(token))
  return Boolean(row && row.expires_at > Date.now())
}

export function requireAdmin(cookie: SessionCookie) {
  if (!isAdmin(cookie)) throw new HttpError(401, 'Faça login no painel')
}

/**
 * IP do visitante. Atrás do proxy vem no X-Forwarded-For (o nginx sobrescreve, não dá pra forjar).
 * IPv6 é agrupado por /64 — cada casa/celular recebe um bloco inteiro, então contar por IP seria fácil de driblar.
 */
export function clientIp(request: Request, server: { requestIP(r: Request): { address: string } | null } | null) {
  const forwarded = TRUST_PROXY ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() : undefined
  const ip = forwarded || server?.requestIP(request)?.address || 'desconhecido'
  if (!ip.includes(':') || ip.startsWith('::ffff:')) return ip
  return ip.split(':').slice(0, 4).join(':') + '::/64'
}

/** Contador de eventos por chave numa janela fixa. Guarda no máx. `maxKeys` chaves (as vencidas saem primeiro). */
function createLimiter(max: number, windowMs: number, maxKeys = 10_000) {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return {
    blocked(key: string) {
      const entry = hits.get(key)
      return Boolean(entry && entry.resetAt > Date.now() && entry.count >= max)
    },
    hit(key: string) {
      const now = Date.now()
      let entry = hits.get(key)
      if (!entry || entry.resetAt <= now) {
        if (hits.size >= maxKeys) {
          for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
          // Ainda cheio (ataque com muitos IPs): descarta os mais antigos
          for (const k of hits.keys()) {
            if (hits.size < maxKeys) break
            hits.delete(k)
          }
        }
        entry = { count: 0, resetAt: now + windowMs }
        hits.set(key, entry)
      }
      entry.count++
    },
    clear(key: string) {
      hits.delete(key)
    },
  }
}

/**
 * Freio contra chute de senha: 5 erros por IP a cada 15 min,
 * e no máx. 30 erros somando todos os IPs (pega quem troca de IP a cada tentativa).
 */
const loginFailsByIp = createLimiter(5, 15 * 60_000)
const loginFailsGlobal = createLimiter(30, 15 * 60_000, 1)

export function guardLogin(ip: string) {
  if (loginFailsByIp.blocked(ip) || loginFailsGlobal.blocked('*')) {
    throw new HttpError(429, 'Muitas tentativas — espere uns minutos e tente de novo')
  }
  return {
    fail() {
      loginFailsByIp.hit(ip)
      loginFailsGlobal.hit('*')
    },
    succeed() {
      loginFailsByIp.clear(ip)
    },
  }
}

/** Limite simples por IP pras rotas públicas que gravam no servidor (cadastro com foto, curtidas). */
export function rateLimit(max: number, windowMs: number, message: string) {
  const limiter = createLimiter(max, windowMs)
  return (ip: string) => {
    if (limiter.blocked(ip)) throw new HttpError(429, message)
    limiter.hit(ip)
  }
}

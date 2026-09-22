import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { Elysia, t } from 'elysia'
import { parseAge, serializeAge } from '../src/lib/age.ts'
import {
  SESSION_COOKIE,
  checkCredentials,
  clientIp,
  endSession,
  guardLogin,
  hashToken,
  isAdmin,
  rateLimit,
  requireAdmin,
  startSession,
} from './auth.ts'
import { DIST_DIR, HOST, IS_PROD, PORT } from './config.ts'
import { PET_STATUSES, db, getPet, newPetId, seedIfEmpty, toAdminPet, toPublicPet, type PetRow } from './db.ts'
import { HttpError } from './errors.ts'
import { MAX_IMAGE_BYTES, deleteImage, saveImage, uploadedFile } from './storage.ts'

if (!IS_PROD) seedIfEmpty()

/** Tira espaços das pontas e exige conteúdo nos campos obrigatórios. */
function required(value: string, field: string) {
  const v = value.trim()
  if (!v) throw new HttpError(400, `${field}: obrigatório`)
  return v
}

const optional = (value: string | undefined) => value?.trim() || '—'

const limitNewPets = rateLimit(10, 60 * 60_000, 'Muitos cadastros seguidos — tente de novo mais tarde')
const limitLikes = rateLimit(120, 10 * 60_000, 'Calma! Muitas curtidas seguidas — tente daqui a pouco')

/**
 * Headers de segurança em todas as respostas. A CSP só libera o próprio site,
 * as fontes do Google e o Google Analytics — um XSS não consegue carregar script de fora
 * nem mandar dados pra outro domínio, e ninguém embute o painel num iframe.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://*.googletagmanager.com",
    "style-src 'self' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com",
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  ...(IS_PROD ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
}

/**
 * Freio extra contra CSRF: requisição que altera dados vinda de outra origem é recusada.
 * O cookie SameSite=Lax já barra outros sites, mas não outros subdomínios do mesmo domínio.
 */
function checkOrigin(request: Request) {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return
  const origin = request.headers.get('origin')
  if (!origin) return
  let host: string
  try {
    host = new URL(origin).host
  } catch {
    host = ''
  }
  if (host !== request.headers.get('host')) throw new HttpError(403, 'Origem não permitida')
}

const api = new Elysia({ prefix: '/api' })
  .onBeforeHandle(({ request }) => checkOrigin(request))

  // ---------- público ----------
  .get('/pets', () =>
    db
      .query<PetRow, []>("SELECT * FROM pets WHERE status = 'ativo' ORDER BY created_at DESC LIMIT 200")
      .all()
      .map(toPublicPet),
  )

  .get('/pets/:id', ({ params }) => {
    const row = getPet(params.id)
    if (!row || row.status !== 'ativo') throw new HttpError(404, 'Pet não encontrado')
    return toPublicPet(row)
  })

  /**
   * Cadastro do pet (multipart). Nasce "pendente" e devolve um editToken:
   * é ele que prova, no passo seguinte, que quem escolhe o valor da doação é quem cadastrou.
   */
  .post(
    '/pets',
    async ({ body, request, server, set }) => {
      limitNewPets(clientIp(request, server))
      const name = required(body.name, 'Nome')
      const parsedAge = parseAge(body.age)
      if (!parsedAge) throw new HttpError(400, 'Idade: use 2 para anos ou 0.6 para 6 meses')
      const age = serializeAge(parsedAge)
      const contact = required(body.contact, 'Contato')
      const digits = contact.replace(/\D/g, '').length
      if (digits < 10 || digits > 11) throw new HttpError(400, 'Contato: número inválido')

      const photo = await saveImage(body.photo)
      const id = newPetId(name)
      const editToken = randomBytes(24).toString('base64url')
      db.query(`
        INSERT INTO pets (id, name, age, photo, exotic_food, adopted_how, favorite_play, contact, edit_token, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, age, photo, optional(body.exoticFood), optional(body.adoptedHow), optional(body.favoritePlay), contact, hashToken(editToken), Date.now())

      set.status = 201
      return { pet: toPublicPet(getPet(id)!), editToken }
    },
    {
      body: t.Object({
        photo: t.File({ error: 'Adicione uma foto do seu pet' }),
        name: t.String({ maxLength: 24, error: 'Nome: até 24 caracteres' }),
        age: t.String({ maxLength: 10, error: 'Idade: até 10 caracteres' }),
        exoticFood: t.Optional(t.String({ maxLength: 60, error: 'Comida favorita: até 60 caracteres' })),
        adoptedHow: t.Optional(t.String({ maxLength: 60, error: 'Como foi adotado: até 60 caracteres' })),
        favoritePlay: t.Optional(t.String({ maxLength: 60, error: 'Brincadeira favorita: até 60 caracteres' })),
        contact: t.String({ maxLength: 20, error: 'Contato: número inválido' }),
      }),
    },
  )

  /** Valor que o tutor escolheu doar — só enquanto o pet está pendente e com o token do cadastro. */
  .put(
    '/pets/:id/donation',
    ({ params, body, headers, set }) => {
      const { changes } = db
        .query("UPDATE pets SET donation = ? WHERE id = ? AND edit_token = ? AND status = 'pendente'")
        .run(Math.round(body.amount * 100) / 100, params.id, hashToken(headers['x-edit-token'] ?? ''))
      if (changes === 0) throw new HttpError(403, 'Não foi possível atualizar a doação deste pet')
      set.status = 204
    },
    { body: t.Object({ amount: t.Number({ minimum: 1, maximum: 100_000, error: 'Valor de doação inválido' }) }) },
  )

  /** Curtida anônima: o front lembra quem já curtiu (localStorage) e manda liked true/false. */
  .post(
    '/pets/:id/like',
    ({ params, body, request, server }) => {
      limitLikes(clientIp(request, server))
      const row = db
        .query<{ likes: number }, [number, string]>("UPDATE pets SET likes = MAX(0, likes + ?) WHERE id = ? AND status = 'ativo' RETURNING likes")
        .get(body.liked ? 1 : -1, params.id)
      if (!row) throw new HttpError(404, 'Pet não encontrado')
      return row
    },
    { body: t.Object({ liked: t.Boolean() }) },
  )

  // ---------- painel do abrigo ----------
  .post(
    '/admin/login',
    ({ body, cookie, request, server, set }) => {
      const guard = guardLogin(clientIp(request, server))
      if (!checkCredentials(body.email, body.password)) {
        guard.fail()
        throw new HttpError(401, 'E-mail ou senha incorretos')
      }
      guard.succeed()
      startSession(cookie[SESSION_COOKIE])
      set.status = 204
    },
    { body: t.Object({ email: t.String({ maxLength: 200 }), password: t.String({ maxLength: 200 }) }) },
  )

  .post('/admin/logout', ({ cookie, set }) => {
    endSession(cookie[SESSION_COOKIE])
    set.status = 204
  })

  .get('/admin/me', ({ cookie }) => ({ admin: isAdmin(cookie[SESSION_COOKIE]) }))

  .group('/admin/pets', (admin) =>
    admin
      .onBeforeHandle(({ cookie }) => requireAdmin(cookie[SESSION_COOKIE]))

      .get('', () => db.query<PetRow, []>('SELECT * FROM pets ORDER BY created_at DESC').all().map(toAdminPet))

      .patch(
        '/:id',
        ({ params, body }) => {
          const { changes } = db.query('UPDATE pets SET status = ? WHERE id = ?').run(body.status, params.id)
          if (changes === 0) throw new HttpError(404, 'Pet não encontrado')
          return toAdminPet(getPet(params.id)!)
        },
        { body: t.Object({ status: t.UnionEnum(PET_STATUSES, { error: 'Status inválido' }) }) },
      )

      .delete('/:id', async ({ params, set }) => {
        const row = getPet(params.id)
        if (!row) throw new HttpError(404, 'Pet não encontrado')
        db.query('DELETE FROM pets WHERE id = ?').run(row.id)
        await deleteImage(row.photo)
        set.status = 204
      }),
  )

const app = new Elysia({ serve: { maxRequestBodySize: MAX_IMAGE_BYTES + 256 * 1024 } })
  .onRequest(({ set }) => {
    Object.assign(set.headers, SECURITY_HEADERS)
  })
  .onError(({ code, error, set }) => {
    if (error instanceof HttpError) {
      set.status = error.status
      return { error: error.message }
    }
    if (code === 'VALIDATION') {
      set.status = 400
      // Com `error` definido no schema, a mensagem já vem em português
      return { error: error.message.startsWith('{') ? 'Dados inválidos' : error.message }
    }
    if (code === 'PARSE') {
      set.status = 400
      return { error: 'Corpo da requisição inválido' }
    }
    if (code === 'NOT_FOUND') {
      set.status = 404
      return { error: 'Não encontrado' }
    }
    console.error(error)
    set.status = 500
    return { error: 'Erro no servidor — tente de novo' }
  })
  .use(api)

  // Nome das fotos é UUID: o conteúdo de uma URL nunca muda, então o navegador pode guardar pra sempre.
  .get('/uploads/:name', async ({ params }) => {
    const file = uploadedFile(params.name)
    if (!file || !(await file.exists())) throw new HttpError(404, 'Foto não encontrada')
    return new Response(file, {
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
    })
  })

// Em produção o mesmo processo serve o front já buildado (bun run build → dist/).
if (IS_PROD && existsSync(join(DIST_DIR, 'index.html'))) {
  app.get('/*', async ({ path }) => {
    if (path.startsWith('/api/')) throw new HttpError(404, 'Não encontrado')
    let decoded: string
    try {
      decoded = decodeURIComponent(path)
    } catch {
      throw new HttpError(400, 'Endereço inválido')
    }
    const target = normalize(join(DIST_DIR, decoded))
    if (target.startsWith(DIST_DIR + sep) && extname(target)) {
      const file = Bun.file(target)
      if (await file.exists()) {
        // Arquivos em assets/ têm hash no nome — podem ficar em cache pra sempre
        const cache = path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
        return new Response(file, { headers: { 'Cache-Control': cache } })
      }
    }
    // Rotas do React (/reels, /admin…) sempre recebem o index.html
    return new Response(Bun.file(join(DIST_DIR, 'index.html')), { headers: { 'Cache-Control': 'no-cache' } })
  })
}

app.listen({ port: PORT, hostname: HOST }, ({ hostname, port }) => {
  console.log(`[api] rodando em http://${hostname}:${port}`)
})

import { Database } from 'bun:sqlite'
import { randomBytes, randomUUID } from 'node:crypto'
import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { DB_PATH, UPLOADS_DIR } from './config.ts'
import { imageUrl } from './storage.ts'

export type PetStatus = 'pendente' | 'ativo' | 'oculto'
export const PET_STATUSES = ['pendente', 'ativo', 'oculto'] as const

export interface PetRow {
  id: string
  name: string
  age: string
  photo: string
  exotic_food: string
  adopted_how: string
  favorite_play: string
  contact: string
  donation: number
  status: PetStatus
  likes: number
  edit_token: string | null
  created_at: number
}

export const db = new Database(DB_PATH, { create: true, strict: true })

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS pets (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    age           TEXT NOT NULL,
    photo         TEXT NOT NULL,
    exotic_food   TEXT NOT NULL,
    adopted_how   TEXT NOT NULL,
    favorite_play TEXT NOT NULL,
    contact       TEXT NOT NULL,
    donation      REAL NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativo', 'oculto')),
    likes         INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
    edit_token    TEXT,
    created_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS pets_status_created ON pets (status, created_at DESC);

  -- token = sha256 do valor do cookie (um backup vazado não vira sessão válida)
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

export const getPet = (id: string) => db.query<PetRow, [string]>('SELECT * FROM pets WHERE id = ?').get(id)

/** O que qualquer visitante vê — sem telefone do tutor nem valor doado. */
export function toPublicPet(row: PetRow) {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    photo: imageUrl(row.photo),
    exoticFood: row.exotic_food,
    adoptedHow: row.adopted_how,
    favoritePlay: row.favorite_play,
    status: row.status,
    likes: row.likes,
    createdAt: row.created_at,
  }
}

export function toAdminPet(row: PetRow) {
  return { ...toPublicPet(row), contact: row.contact, donation: row.donation }
}

export function newPetId(name: string) {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'pet'}-${randomBytes(4).toString('hex')}`
}

/** Pets de exemplo pra desenvolvimento — só entram com o banco vazio e fora de produção. */
export function seedIfEmpty() {
  const { n } = db.query<{ n: number }, []>('SELECT COUNT(*) AS n FROM pets').get()!
  if (n > 0) return

  const day = 86_400_000
  const now = Date.now()
  const samples = [
    ['Luizinha', '5', 'pet-luizinha.jpg', 'Manga congelada', 'Encontrado num parque', 'Perseguir bolhas', '(43) 99999-9999', 15, 'ativo', 2400, 3],
    ['Thor', '3', 'pet-thor.jpg', 'Casca de melancia', 'Veio de uma feira de adoção', 'Cabo de guerra', '(43) 98888-7777', 25, 'ativo', 1870, 2],
    ['Nina', '2', 'pet-nina.jpg', 'Brócolis cozido', 'Resgatada da chuva', 'Esconder meias', '(43) 97777-6666', 10, 'pendente', 0, 1],
  ] as const

  const insert = db.query(`
    INSERT INTO pets (id, name, age, photo, exotic_food, adopted_how, favorite_play, contact, donation, status, likes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const [name, age, file, food, how, play, contact, donation, status, likes, daysAgo] of samples) {
    const photo = `${randomUUID()}.jpg`
    copyFileSync(join(import.meta.dir, 'seed', file), join(UPLOADS_DIR, photo))
    insert.run(newPetId(name), name, age, photo, food, how, play, contact, donation, status, likes, now - day * daysAgo)
  }
  console.log('[db] banco vazio — 3 pets de exemplo criados')
}

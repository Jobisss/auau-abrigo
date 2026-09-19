import { randomUUID } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { UPLOADS_DIR } from './config.ts'
import { HttpError } from './errors.ts'

/**
 * Fotos ficam como arquivos em data/uploads/ (o banco guarda só o nome do arquivo).
 * O nome é um UUID, então a URL nunca muda de conteúdo e pode ter cache "eterno".
 * Pra migrar pra um bucket (R2/S3) no futuro, basta trocar este arquivo.
 */

/** O front já reduz a foto pra no máx. 1080x1920 antes de enviar; isto é só a trava de segurança. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const FORMATS = [
  { ext: 'jpg', test: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', test: (b: Buffer) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
]

const SAFE_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/

/** Confere o conteúdo real do arquivo (não confia no Content-Type nem na extensão) e salva. Devolve o nome. */
export async function saveImage(file: File): Promise<string> {
  if (file.size === 0) throw new HttpError(400, 'Foto vazia')
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, 'Foto muito grande (máx. 5 MB)')

  const buf = Buffer.from(await file.arrayBuffer())
  const format = FORMATS.find((f) => f.test(buf))
  if (!format) throw new HttpError(415, 'Formato de foto não suportado — use JPG, PNG ou WebP')

  const name = `${randomUUID()}.${format.ext}`
  await writeFile(join(UPLOADS_DIR, name), buf, { flag: 'wx' })
  return name
}

export async function deleteImage(name: string) {
  if (!SAFE_NAME.test(name)) return
  await rm(join(UPLOADS_DIR, name), { force: true })
}

export const imageUrl = (name: string) => `/uploads/${name}`

/** Arquivo pra servir em /uploads/:name — só nomes gerados por nós (sem "../" nem nada estranho). */
export function uploadedFile(name: string) {
  return SAFE_NAME.test(name) ? Bun.file(join(UPLOADS_DIR, name)) : null
}

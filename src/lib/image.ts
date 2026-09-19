/** Tamanho máximo do Reels em tela cheia (9:16). Foto maior que isso é só peso pra baixar. */
const MAX_W = 1080
const MAX_H = 1920
const QUALITY = 0.85

/**
 * Reduz a foto do celular (que costuma ter 3–10 MB) pra no máx. 1080×1920 em JPEG,
 * já corrigindo a rotação do EXIF. Resultado típico: 150–400 KB.
 */
export async function resizeImage(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Nao consegui abrir essa foto — tente outra (JPG ou PNG)')
  }

  const scale = Math.min(1, MAX_W / bitmap.width, MAX_H / bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  // PNG com transparência vira fundo creme em vez de preto
  ctx.fillStyle = '#FFF9F0'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao preparar a foto'))), 'image/jpeg', QUALITY),
  )
}

import QRCode from 'qrcode'
import { SHELTER, type Pet } from '../data/mock'
import { formatAge } from './age'

/**
 * Monta a imagem de story (1080×1920) pra compartilhar: foto do pet no fundo,
 * nome/idade, selo do abrigo e um QR Code pro site — quem vê o story posta o pet dele também.
 * Tudo que importa fica fora do topo e da base, que o Instagram cobre com a própria interface.
 */

const W = 1080
const H = 1920

const INK = '#1a2b4a'
const INK_SOFT = '#4a6080'
const CREAM = '#fff9f0'
const YELLOW = '#fec601'
const ORANGE = '#ea7317'
const BLUE = '#2364aa'
const WHITE = '#ffffff'

const HAND = '"Just Me Again Down Here"'
const BODY = '"Balsamiq Sans"'

/** Patinha clássica numa caixa 24×24: almofada + 4 dedos (em [x, y, raioX, raioY, rotação]). */
const PAW_PARTS: [number, number, number, number, number][] = [
  [12, 16, 5.6, 4.6, 0],
  [4.6, 9.6, 2.3, 2.9, -0.45],
  [9.2, 5.4, 2.5, 3.1, -0.15],
  [14.8, 5.4, 2.5, 3.1, 0.15],
  [19.4, 9.6, 2.3, 2.9, 0.45],
]

type Ctx = CanvasRenderingContext2D

export interface StoryOptions {
  /** Endereço que o QR Code abre (a home do site). */
  url: string
}

export async function renderStory(pet: Pet, { url }: StoryOptions): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`150px ${HAND}`),
    document.fonts.load(`700 40px ${BODY}`),
    document.fonts.load(`400 36px ${BODY}`),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  await drawBackground(ctx, pet.photo)
  drawShelterBadge(ctx)
  drawPetBlock(ctx, pet)
  await drawInvitePanel(ctx, url)
  drawFooter(ctx)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), 'image/jpeg', 0.92),
  )
}

// ---------- partes ----------

async function drawBackground(ctx: Ctx, photo: string) {
  ctx.fillStyle = ORANGE
  ctx.fillRect(0, 0, W, H)
  try {
    const img = await loadImage(photo)
    // "cover": preenche tudo sem distorcer
    const scale = Math.max(W / img.width, H / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
  } catch {
    drawPawPattern(ctx)
  }

  // Sombra no topo (selo legível) e degradê forte embaixo (texto + card)
  const top = ctx.createLinearGradient(0, 0, 0, 520)
  top.addColorStop(0, 'rgba(26,43,74,0.55)')
  top.addColorStop(1, 'rgba(26,43,74,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, 520)

  const bottom = ctx.createLinearGradient(0, 760, 0, H)
  bottom.addColorStop(0, 'rgba(26,43,74,0)')
  bottom.addColorStop(0.45, 'rgba(26,43,74,0.82)')
  bottom.addColorStop(1, 'rgba(26,43,74,0.96)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, 760, W, H - 760)
}

function drawShelterBadge(ctx: Ctx) {
  const text = SHELTER.name
  ctx.font = `700 40px ${BODY}`
  const padX = 34
  const icon = 44
  const h = 96
  const w = padX + icon + 18 + ctx.measureText(text).width + padX
  const x = (W - w) / 2
  const y = 262

  sketchBox(ctx, x, y, w, h, h / 2, WHITE, 6, 8)
  drawPaw(ctx, x + padX, y + (h - icon) / 2, icon, ORANGE)
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX + icon + 18, y + h / 2 + 2)
}

function drawPetBlock(ctx: Ctx, pet: Pet) {
  const left = 72
  const maxW = W - left * 2

  // Adesivo amarelo torto — o "motivo" do post
  withRotation(ctx, left + 250, 968, -4, () => {
    ctx.font = `700 44px ${BODY}`
    const label = 'Eu ajudo o abrigo 💛'
    const w = ctx.measureText(label).width + 64
    sketchBox(ctx, -w / 2, -44, w, 88, 22, YELLOW, 6, 7)
    ctx.fillStyle = INK
    ctx.textBaseline = 'middle'
    ctx.fillText(label, -w / 2 + 32, 3)
  })

  // Nome grande à mão — encolhe se não couber
  let size = 190
  ctx.font = `${size}px ${HAND}`
  while (ctx.measureText(pet.name).width > maxW && size > 90) {
    size -= 6
    ctx.font = `${size}px ${HAND}`
  }
  ctx.textBaseline = 'alphabetic'
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 4
  ctx.fillStyle = WHITE
  ctx.fillText(pet.name, left, 1168)
  ctx.restore()

  ctx.font = `700 50px ${BODY}`
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(formatAge(pet.age), left + 6, 1232)
}

async function drawInvitePanel(ctx: Ctx, url: string) {
  const x = 56
  const y = 1286
  const w = W - x * 2
  const h = 372
  sketchBox(ctx, x, y, w, h, 44, CREAM, 6, 10)

  // QR à direita, num quadradinho branco levemente torto
  const qrSize = 264
  const qrX = x + w - qrSize - 52
  const qrY = y + (h - qrSize) / 2
  withRotation(ctx, qrX + qrSize / 2, qrY + qrSize / 2, 3, () => {
    const pad = 18
    sketchBox(ctx, -qrSize / 2 - pad, -qrSize / 2 - pad, qrSize + pad * 2, qrSize + pad * 2, 26, WHITE, 5, 7)
  })
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, url, {
    width: qrSize,
    margin: 0,
    errorCorrectionLevel: 'H', // aguenta a patinha no meio
    color: { dark: INK, light: WHITE },
  })
  withRotation(ctx, qrX + qrSize / 2, qrY + qrSize / 2, 3, () => {
    ctx.drawImage(qr, -qrSize / 2, -qrSize / 2)
    const r = qrSize * 0.12
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = WHITE
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = INK
    ctx.stroke()
    drawPaw(ctx, -r * 0.62, -r * 0.62, r * 1.24, ORANGE)
  })

  // Texto à esquerda
  const tx = x + 52
  const textW = qrX - tx - 64
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  let titleSize = 96
  ctx.font = `${titleSize}px ${HAND}`
  while (ctx.measureText('Poste o seu pet!').width > textW && titleSize > 60) {
    titleSize -= 4
    ctx.font = `${titleSize}px ${HAND}`
  }
  ctx.fillText('Poste o seu pet!', tx, y + 116)

  ctx.font = `400 35px ${BODY}`
  ctx.fillStyle = INK_SOFT
  wrapText(ctx, 'Aponte a camera no QR e ajude o abrigo junto com a gente.', tx, y + 174, textW, 46)

  // Endereço do site numa pílula azul
  const host = new URL(url).host
  ctx.font = `700 34px ${BODY}`
  const pillW = Math.min(ctx.measureText(host).width + 56, textW)
  sketchBox(ctx, tx, y + h - 112, pillW, 68, 34, BLUE, 5, 6)
  ctx.fillStyle = WHITE
  ctx.textBaseline = 'middle'
  ctx.fillText(host, tx + 28, y + h - 112 + 36, pillW - 56)
}

/** @ do abrigo na base — aparece no status do WhatsApp; no Instagram fica sob a caixa de resposta. */
function drawFooter(ctx: Ctx) {
  const text = `@${SHELTER.instagram}`
  ctx.font = `700 32px ${BODY}`
  const icon = 34
  const gap = 12
  const w = icon + gap + ctx.measureText(text).width
  const x = (W - w) / 2
  const y = 1740
  drawPaw(ctx, x, y - icon / 2, icon, 'rgba(255,255,255,0.7)')
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + icon + gap, y + 2)
}

// ---------- utilitários ----------

/** Caixa no estilo do app: contorno grosso escuro + sombra "dura" deslocada. */
function sketchBox(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke: number, shadow: number) {
  ctx.beginPath()
  ctx.roundRect(x + shadow, y + shadow, w, h, r)
  ctx.fillStyle = INK
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = stroke
  ctx.strokeStyle = INK
  ctx.stroke()
}

function drawPaw(ctx: Ctx, x: number, y: number, size: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.fillStyle = color
  for (const [cx, cy, rx, ry, rot] of PAW_PARTS) {
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawPawPattern(ctx: Ctx) {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 5; col++) {
      withRotation(ctx, col * 240 + (row % 2) * 120 + 60, row * 210 + 80, row % 2 ? 18 : -18, () =>
        drawPaw(ctx, -40, -40, 80, 'rgba(255,255,255,0.18)'),
      )
    }
  }
}

function withRotation(ctx: Ctx, cx: number, cy: number, deg: number, draw: () => void) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((deg * Math.PI) / 180)
  draw()
  ctx.restore()
}

function wrapText(ctx: Ctx, text: string, x: number, y: number, maxW: number, lineH: number) {
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y)
      line = word
      y += lineH
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, y)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

import QRCode from 'qrcode'
import { SHELTER, type Pet } from '../data/mock'
import { formatAge } from './age'

/**
 * Imagens de story (1080×1920) pra compartilhar, em 3 modelos. Todas levam um QR Code
 * pro site — quem vê o story posta o pet dele também. O que importa fica fora do topo
 * (~250px) e da base (~250px), que o Instagram cobre com a própria interface.
 */

export type StoryTemplate = 'foto' | 'polaroid' | 'carteirinha'

export const STORY_TEMPLATES: { id: StoryTemplate; label: string }[] = [
  { id: 'foto', label: 'Foto' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'carteirinha', label: 'Carteirinha' },
]

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

/** A mensagem do story: "{Nome}! Está pedindo para você ajudar o abrigo". */
const ASK = 'Está pedindo para você ajudar o abrigo'
/** Selo do topo de todos os modelos. */
const BADGE = 'Doe para o abrigo'
/** Deixa claro pra qual abrigo vai a doação. */
const SHELTER_PLACE = `${SHELTER.name} · Ivaiporã - PR`

type Ctx = CanvasRenderingContext2D

export async function renderStory(pet: Pet, template: StoryTemplate, url: string): Promise<Blob> {
  await loadFonts()
  const photo = await loadImage(pet.photo).catch(() => null)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  const draw = { foto: drawFoto, polaroid: drawPolaroid, carteirinha: drawCarteirinha }[template]
  await draw(ctx, pet, photo, url)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), 'image/jpeg', 0.92),
  )
}

// =====================================================================
// 1) Foto — o pet em tela cheia, card com convite + QR embaixo
// =====================================================================

async function drawFoto(ctx: Ctx, pet: Pet, photo: HTMLImageElement | null, url: string) {
  ctx.fillStyle = ORANGE
  ctx.fillRect(0, 0, W, H)
  if (photo) drawCover(ctx, photo, 0, 0, W, H)
  else pawPattern(ctx, 'rgba(255,255,255,0.18)')

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

  shelterBadge(ctx, 262, WHITE)
  placeTag(ctx, 404)

  // "{Nome}!" grande à mão — encolhe se não couber
  const left = 72
  const name = `${pet.name}!`
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${fitFont(ctx, name, HAND, '', 190, 90, W - left * 2)}px ${HAND}`
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 4
  ctx.fillStyle = WHITE
  ctx.fillText(name, left, 1078)
  ctx.restore()

  // Adesivo amarelo torto com o pedido
  const lines = ['Está pedindo para você', 'ajudar o abrigo 💛']
  ctx.font = `700 44px ${BODY}`
  const sw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 64
  const sh = 136
  withRotation(ctx, left + sw / 2, 1112 + sh / 2, -2.5, () => {
    sketchBox(ctx, -sw / 2, -sh / 2, sw, sh, 24, YELLOW, 6, 7)
    ctx.fillStyle = INK
    ctx.textBaseline = 'middle'
    ctx.fillText(lines[0], -sw / 2 + 32, -26)
    ctx.fillText(lines[1], -sw / 2 + 32, 30)
  })

  // Card com o convite
  const x = 56
  const y = 1286
  const w = W - x * 2
  const h = 372
  sketchBox(ctx, x, y, w, h, 44, CREAM, 6, 10)
  const qrSize = 264
  await qrSticker(ctx, url, x + w - qrSize / 2 - 70, y + h / 2, qrSize, 3)

  const tx = x + 52
  const textW = w - qrSize - 52 - 70 - 70
  ctx.fillStyle = INK
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${fitFont(ctx, 'Poste o seu pet!', HAND, '', 96, 60, textW)}px ${HAND}`
  ctx.fillText('Poste o seu pet!', tx, y + 116)
  ctx.font = `400 35px ${BODY}`
  ctx.fillStyle = INK_SOFT
  wrapText(ctx, 'Aponte a câmera no QR e ajude o abrigo junto com a gente.', tx, y + 174, textW, 46)
  sitePill(ctx, url, tx, y + h - 112, textW, BLUE, WHITE)

  footerHandle(ctx, 'rgba(255,255,255,0.7)')
}

// =====================================================================
// 2) Polaroid — scrapbook: foto torta com fita, adesivo redondo, rabiscos
// =====================================================================

async function drawPolaroid(ctx: Ctx, pet: Pet, photo: HTMLImageElement | null, url: string) {
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, W, H)
  pawPattern(ctx, 'rgba(35,100,170,0.13)')

  shelterBadge(ctx, 250, WHITE)

  // Rabiscos em volta
  star(ctx, 112, 470, 40, YELLOW)
  star(ctx, 986, 1150, 30, YELLOW)
  heart(ctx, 968, 440, 64, { stroke: ORANGE, lineWidth: 7, rotate: 14 })
  heart(ctx, 118, 1318, 72, { stroke: BLUE, lineWidth: 7, rotate: -16 })
  sparkle(ctx, 212, 380, 22, INK)
  sparkle(ctx, 1000, 1290, 18, INK)

  // A polaroid (as fitas no topo não podem encostar no selo)
  const pw = 780
  const ph = 900
  withRotation(ctx, 540, 894, -3.5, () => {
    sketchBox(ctx, -pw / 2, -ph / 2, pw, ph, 16, WHITE, 6, 14)
    const inset = 42
    const size = pw - inset * 2
    const px = -pw / 2 + inset
    const py = -ph / 2 + inset
    ctx.fillStyle = ORANGE
    ctx.fillRect(px, py, size, size)
    if (photo) drawCover(ctx, photo, px, py, size, size, 6)
    else drawPaw(ctx, px + size / 2 - 120, py + size / 2 - 120, 240, 'rgba(255,255,255,0.6)')
    ctx.lineWidth = 4
    ctx.strokeStyle = INK
    ctx.beginPath()
    ctx.roundRect(px, py, size, size, 6)
    ctx.stroke()

    // Legenda no rodapé da polaroid: "{Nome}!" à mão + o pedido embaixo
    const capTop = py + size
    const name = `${pet.name}!`
    ctx.fillStyle = INK
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${fitFont(ctx, name, HAND, '', 96, 56, size)}px ${HAND}`
    ctx.fillText(name, 0, capTop + 58)
    const ask = `${ASK.toLowerCase()} 💛`
    ctx.font = `700 ${fitFont(ctx, ask, BODY, '700', 32, 22, size)}px ${BODY}`
    ctx.fillStyle = INK_SOFT
    ctx.fillText(ask, 0, capTop + 122)
    ctx.textAlign = 'left'

    tape(ctx, -pw / 2 + 70, -ph / 2 + 4, -38)
    tape(ctx, pw / 2 - 70, -ph / 2 + 4, 38)
  })

  // Adesivo redondo colado no canto da foto (sem cobrir a legenda)
  withRotation(ctx, 858, 1030, 10, () => {
    const r = 122
    ctx.beginPath()
    ctx.arc(8, 8, r, 0, Math.PI * 2)
    ctx.fillStyle = INK
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = ORANGE
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = INK
    ctx.stroke()
    ctx.setLineDash([4, 12])
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.beginPath()
    ctx.arc(0, 0, r - 16, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = WHITE
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 40px ${BODY}`
    // Selo com o nome e a cidade do abrigo
    ctx.font = `700 22px ${BODY}`
    withLetterSpacing(ctx, '4px', () => ctx.fillText('ABRIGO', 2, -56))
    ctx.font = `700 40px ${BODY}`
    ctx.fillText('Toca de', 0, -18)
    ctx.fillText('Assis', 0, 22)
    // Nessa altura o círculo tracejado só tem ~150px de largura
    ctx.font = `700 ${fitFont(ctx, 'Ivaiporã - PR', BODY, '700', 22, 16, 144)}px ${BODY}`
    ctx.fillText('Ivaiporã - PR', 0, 56)
    ctx.textAlign = 'left'
  })

  // Cupom recortável com o convite + QR
  const cx = 64
  const cy = 1392
  const cw = W - cx * 2
  const ch = 278
  ctx.beginPath()
  ctx.roundRect(cx, cy, cw, ch, 30)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fill()
  ctx.setLineDash([20, 14])
  ctx.lineWidth = 5
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.setLineDash([])
  // tesourinha em cima da linha tracejada
  ctx.fillStyle = CREAM
  ctx.fillRect(cx + 44, cy - 26, 60, 52)
  ctx.font = `48px ${BODY}`
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  ctx.fillText('✂', cx + 50, cy + 2)

  const qrSize = 200
  await qrSticker(ctx, url, cx + cw - qrSize / 2 - 46, cy + ch / 2, qrSize, 4)
  const tx = cx + 44
  const textW = cw - qrSize - 46 - 44 - 60
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `${fitFont(ctx, 'Poste o seu pet!', HAND, '', 92, 60, textW)}px ${HAND}`
  ctx.fillText('Poste o seu pet!', tx, cy + 98)
  ctx.font = `400 34px ${BODY}`
  ctx.fillStyle = INK_SOFT
  ctx.fillText('Aponte a câmera no QR 👉', tx, cy + 152, textW)
  sitePill(ctx, url, tx, cy + ch - 94, textW, BLUE, WHITE, 62)

  footerHandle(ctx, INK_SOFT)
}

// =====================================================================
// 3) Carteirinha — "RG" oficial de pet solidário, com carimbo e QR
// =====================================================================

async function drawCarteirinha(ctx: Ctx, pet: Pet, photo: HTMLImageElement | null, url: string) {
  ctx.fillStyle = BLUE
  ctx.fillRect(0, 0, W, H)
  pawPattern(ctx, 'rgba(255,255,255,0.08)')

  // Título
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = WHITE
  ctx.font = `128px ${HAND}`
  ctx.fillText('Carteirinha Oficial', W / 2, 352)
  ctx.font = `700 46px ${BODY}`
  ctx.fillStyle = YELLOW
  ctx.fillText('de Pet Solidário 🐾', W / 2, 428)
  ctx.textAlign = 'left'

  // O cartão (levemente torto, como se estivesse na mesa)
  const cw = 960
  const ch = 900
  await withRotationAsync(ctx, W / 2, 500 + ch / 2, -1.5, async () => {
    const x = -cw / 2
    const y = -ch / 2
    sketchBox(ctx, x, y, cw, ch, 40, CREAM, 7, 14)

    // Faixa amarela do cabeçalho
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, cw, ch, 40)
    ctx.clip()
    ctx.fillStyle = YELLOW
    ctx.fillRect(x, y, cw, 112)
    ctx.restore()
    ctx.beginPath()
    ctx.moveTo(x, y + 112)
    ctx.lineTo(x + cw, y + 112)
    ctx.lineWidth = 6
    ctx.strokeStyle = INK
    ctx.stroke()
    ctx.beginPath()
    ctx.roundRect(x, y, cw, ch, 40)
    ctx.lineWidth = 7
    ctx.stroke()

    drawPaw(ctx, x + 40, y + 34, 46, ORANGE)
    ctx.fillStyle = INK
    ctx.textBaseline = 'middle'
    ctx.font = `700 38px ${BODY}`
    withLetterSpacing(ctx, '3px', () => ctx.fillText(BADGE.toUpperCase(), x + 104, y + 60))
    ctx.font = `700 32px ${BODY}`
    ctx.textAlign = 'right'
    ctx.fillText(`Nº ${cardNumber(pet.id)}`, x + cw - 40, y + 60)
    ctx.textAlign = 'left'

    // Foto 3x4
    const fx = x + 44
    const fy = y + 152
    const fw = 380
    const fh = 480
    ctx.fillStyle = ORANGE
    ctx.beginPath()
    ctx.roundRect(fx, fy, fw, fh, 22)
    ctx.fill()
    if (photo) drawCover(ctx, photo, fx, fy, fw, fh, 22)
    else drawPaw(ctx, fx + fw / 2 - 90, fy + fh / 2 - 90, 180, 'rgba(255,255,255,0.6)')
    ctx.beginPath()
    ctx.roundRect(fx, fy, fw, fh, 22)
    ctx.lineWidth = 6
    ctx.strokeStyle = INK
    ctx.stroke()

    // Campos preenchidos "à mão"
    const colX = fx + fw + 50
    const colW = x + cw - 44 - colX
    const fields: [string, string][] = [
      ['NOME', pet.name],
      ['IDADE', formatAge(pet.age)],
      ['COMIDA FAVORITA', pet.exoticFood],
      ['BRINCADEIRA FAVORITA', pet.favoritePlay],
    ]
    fields.forEach(([label, value], i) => {
      const top = fy + 6 + i * 120
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = INK_SOFT
      ctx.font = `700 24px ${BODY}`
      withLetterSpacing(ctx, '2px', () => ctx.fillText(label, colX, top + 24))
      ctx.fillStyle = INK
      ctx.font = `${fitFont(ctx, value, HAND, '', 66, 36, colW)}px ${HAND}`
      ctx.fillText(value, colX, top + 84)
      ctx.setLineDash([3, 10])
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(26,43,74,0.4)'
      ctx.beginPath()
      ctx.moveTo(colX, top + 98)
      ctx.lineTo(colX + colW, top + 98)
      ctx.stroke()
      ctx.setLineDash([])
    })

    // Rodapé do cartão: validade + assinatura à esquerda, QR à direita
    const qrSize = 196
    const qrCx = x + cw - 44 - qrSize / 2 - 18
    const qrCy = y + ch - 44 - qrSize / 2 - 18
    await qrSticker(ctx, url, qrCx, qrCy, qrSize, 0)

    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK
    ctx.font = `700 30px ${BODY}`
    ctx.fillText('Válida em todos os corações 💛', fx, fy + fh + 64)
    ctx.fillStyle = BLUE
    ctx.font = `76px ${HAND}`
    ctx.fillText('Toca de Assis', fx + 10, fy + fh + 158)
    ctx.beginPath()
    ctx.moveTo(fx, fy + fh + 172)
    ctx.lineTo(fx + 420, fy + fh + 172)
    ctx.lineWidth = 3
    ctx.strokeStyle = INK
    ctx.stroke()
    ctx.fillStyle = INK_SOFT
    ctx.font = `400 22px ${BODY}`
    ctx.font = `700 24px ${BODY}`
    ctx.fillText(SHELTER_PLACE, fx, fy + fh + 204, 540)

    // Carimbo por cima da parte de baixo da foto
    stamp(ctx, fx + fw / 2 + 6, fy + fh - 86, -12)
  })

  // Embaixo do cartão: "{Nome}!" + o pedido + como fazer a do seu
  const name = `${pet.name}!`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = YELLOW
  ctx.font = `${fitFont(ctx, name, HAND, '', 104, 60, W - 120)}px ${HAND}`
  ctx.fillText(name, W / 2, 1502)
  ctx.fillStyle = WHITE
  ctx.font = `700 ${fitFont(ctx, `${ASK} 💛`, BODY, '700', 42, 28, W - 120)}px ${BODY}`
  ctx.fillText(`${ASK} 💛`, W / 2, 1566)
  ctx.font = `400 ${fitFont(ctx, `Faça a do seu pet: aponte a câmera no QR 👆 ou entre em ${new URL(url).host}`, BODY, '400', 32, 22, W - 120)}px ${BODY}`
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(`Faça a do seu pet: aponte a câmera no QR 👆 ou entre em ${new URL(url).host}`, W / 2, 1624)
  ctx.textAlign = 'left'

  footerHandle(ctx, 'rgba(255,255,255,0.7)')
}

// =====================================================================
// Peças reaproveitadas
// =====================================================================

/** Etiqueta "📍 Abrigo Toca de Assis · Ivaiporã - PR" sobre fundo escuro (legível em qualquer foto). */
function placeTag(ctx: Ctx, cy: number) {
  const text = `📍 ${SHELTER_PLACE}`
  ctx.font = `700 34px ${BODY}`
  const w = ctx.measureText(text).width + 48
  const h = 60
  ctx.beginPath()
  ctx.roundRect((W - w) / 2, cy - h / 2, w, h, h / 2)
  ctx.fillStyle = 'rgba(26,43,74,0.72)'
  ctx.fill()
  ctx.fillStyle = WHITE
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, W / 2, cy + 2)
  ctx.textAlign = 'left'
}

function shelterBadge(ctx: Ctx, y: number, fill: string) {
  const text = BADGE
  ctx.font = `700 40px ${BODY}`
  const padX = 34
  const icon = 44
  const h = 92
  const w = padX + icon + 18 + ctx.measureText(text).width + padX
  const x = (W - w) / 2
  sketchBox(ctx, x, y, w, h, h / 2, fill, 6, 8)
  drawPaw(ctx, x + padX, y + (h - icon) / 2, icon, ORANGE)
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX + icon + 18, y + h / 2 + 2)
}

/** QR num quadradinho branco (opcionalmente torto), com patinha no meio. */
async function qrSticker(ctx: Ctx, url: string, cx: number, cy: number, size: number, deg: number) {
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, url, {
    width: size,
    margin: 0,
    errorCorrectionLevel: 'H', // aguenta a patinha no meio
    color: { dark: INK, light: WHITE },
  })
  withRotation(ctx, cx, cy, deg, () => {
    const pad = 16
    sketchBox(ctx, -size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2, 24, WHITE, 5, 7)
    ctx.drawImage(qr, -size / 2, -size / 2, size, size)
    const r = size * 0.12
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = WHITE
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = INK
    ctx.stroke()
    drawPaw(ctx, -r * 0.66, -r * 0.7, r * 1.32, ORANGE)
  })
}

/** Endereço do site numa pílula. */
function sitePill(ctx: Ctx, url: string, x: number, y: number, maxW: number, fill: string, color: string, h = 68) {
  const host = new URL(url).host
  ctx.font = `700 34px ${BODY}`
  const w = Math.min(ctx.measureText(host).width + 56, maxW)
  sketchBox(ctx, x, y, w, h, h / 2, fill, 5, 6)
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(host, x + 28, y + h / 2 + 2, w - 56)
}

/** @ do abrigo na base — aparece no status do WhatsApp; no Instagram fica sob a caixa de resposta. */
function footerHandle(ctx: Ctx, color: string) {
  const text = `@${SHELTER.instagram}`
  ctx.font = `700 32px ${BODY}`
  const icon = 34
  const gap = 12
  const w = icon + gap + ctx.measureText(text).width
  const x = (W - w) / 2
  const y = 1760
  drawPaw(ctx, x, y - icon / 2, icon, color)
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + icon + gap, y + 2)
}

function stamp(ctx: Ctx, cx: number, cy: number, deg: number) {
  withRotation(ctx, cx, cy, deg, () => {
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = ORANGE
    ctx.fillStyle = ORANGE
    const w = 300
    const h = 116
    ctx.fillStyle = 'rgba(255,249,240,0.55)'
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, 18)
    ctx.fill()
    ctx.lineWidth = 7
    ctx.stroke()
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(-w / 2 + 11, -h / 2 + 11, w - 22, h - 22, 10)
    ctx.stroke()
    ctx.fillStyle = ORANGE
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 50px ${BODY}`
    withLetterSpacing(ctx, '4px', () => ctx.fillText('APROVADO', 3, 4))
    ctx.textAlign = 'left'
    ctx.globalAlpha = 1
  })
}

/** Fita adesiva amarela meio transparente. */
function tape(ctx: Ctx, cx: number, cy: number, deg: number) {
  withRotation(ctx, cx, cy, deg, () => {
    const w = 200
    const h = 64
    ctx.fillStyle = 'rgba(254,198,1,0.78)'
    ctx.beginPath()
    // pontas "rasgadas"
    ctx.moveTo(-w / 2, -h / 2)
    for (let i = 0; i <= 4; i++) ctx.lineTo(-w / 2 + (i % 2 ? 6 : 0), -h / 2 + (h / 4) * i)
    ctx.lineTo(w / 2, h / 2)
    for (let i = 4; i >= 0; i--) ctx.lineTo(w / 2 - (i % 2 ? 6 : 0), -h / 2 + (h / 4) * i)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.fillRect(-w / 2 + 10, -h / 2 + 10, w - 20, 8)
  })
}

function heart(ctx: Ctx, cx: number, cy: number, s: number, opts: { fill?: string; stroke?: string; lineWidth?: number; rotate?: number }) {
  withRotation(ctx, cx, cy, opts.rotate ?? 0, () => {
    ctx.beginPath()
    ctx.moveTo(0, s * 0.42)
    ctx.bezierCurveTo(-s * 0.1, s * 0.34, -s * 0.62, s * 0.05, -s * 0.56, -s * 0.2)
    ctx.bezierCurveTo(-s * 0.5, -s * 0.52, -s * 0.1, -s * 0.56, 0, -s * 0.24)
    ctx.bezierCurveTo(s * 0.1, -s * 0.56, s * 0.5, -s * 0.52, s * 0.56, -s * 0.2)
    ctx.bezierCurveTo(s * 0.62, s * 0.05, s * 0.1, s * 0.34, 0, s * 0.42)
    ctx.closePath()
    if (opts.fill) {
      ctx.fillStyle = opts.fill
      ctx.fill()
    }
    if (opts.stroke) {
      ctx.lineWidth = opts.lineWidth ?? 6
      ctx.strokeStyle = opts.stroke
      ctx.stroke()
    }
  })
}

function star(ctx: Ctx, cx: number, cy: number, r: number, fill: string) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.48 : r
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = INK
  ctx.stroke()
}

/** Brilhinho de 4 pontas. */
function sparkle(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.quadraticCurveTo(cx, cy, cx + r, cy)
  ctx.quadraticCurveTo(cx, cy, cx, cy + r)
  ctx.quadraticCurveTo(cx, cy, cx - r, cy)
  ctx.quadraticCurveTo(cx, cy, cx, cy - r)
  ctx.fillStyle = color
  ctx.fill()
}

// =====================================================================
// Utilitários
// =====================================================================

let fontsReady: Promise<unknown> | null = null
function loadFonts() {
  fontsReady ??= Promise.all([
    document.fonts.load(`150px ${HAND}`, 'Faça ÁÉÍÓÚ ãõç'),
    document.fonts.load(`700 40px ${BODY}`, 'Faça ÁÉÍÓÚ ãõç'),
    document.fonts.load(`400 36px ${BODY}`, 'Faça ÁÉÍÓÚ ãõç'),
  ])
  return fontsReady
}

/** Número "de registro" estável, tirado do id do pet. */
function cardNumber(id: string) {
  const hex = id.match(/([0-9a-f]{4,})$/)?.[1] ?? '0'
  return String(parseInt(hex.slice(0, 6), 16) % 10000).padStart(4, '0')
}

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

/** Desenha a imagem preenchendo o retângulo sem distorcer ("cover"), com cantos arredondados. */
function drawCover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number, r = 0) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.clip()
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}

/** Patinha clássica numa caixa 24×24: almofada + 4 dedos ([x, y, raioX, raioY, rotação]). */
const PAW_PARTS: [number, number, number, number, number][] = [
  [12, 16, 5.6, 4.6, 0],
  [4.6, 9.6, 2.3, 2.9, -0.45],
  [9.2, 5.4, 2.5, 3.1, -0.15],
  [14.8, 5.4, 2.5, 3.1, 0.15],
  [19.4, 9.6, 2.3, 2.9, 0.45],
]

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

function pawPattern(ctx: Ctx, color: string) {
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 6; col++) {
      withRotation(ctx, col * 200 + (row % 2) * 100 + 40, row * 190 + 60, row % 2 ? 18 : -18, () =>
        drawPaw(ctx, -34, -34, 68, color),
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

async function withRotationAsync(ctx: Ctx, cx: number, cy: number, deg: number, draw: () => Promise<void>) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((deg * Math.PI) / 180)
  await draw()
  ctx.restore()
}

function withLetterSpacing(ctx: Ctx, spacing: string, draw: () => void) {
  const prev = ctx.letterSpacing
  ctx.letterSpacing = spacing
  draw()
  ctx.letterSpacing = prev
}

/** Maior tamanho de fonte (entre max e min) em que o texto cabe na largura. */
function fitFont(ctx: Ctx, text: string, family: string, weight: string, max: number, min: number, maxW: number) {
  let size = max
  ctx.font = `${weight} ${size}px ${family}`.trim()
  while (ctx.measureText(text).width > maxW && size > min) {
    size -= 4
    ctx.font = `${weight} ${size}px ${family}`.trim()
  }
  return size
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

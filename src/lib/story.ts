import QRCode from 'qrcode'
import { SHELTER, type Pet } from '../data/mock'
import { formatAge } from './age'
import {
  BLUE,
  BODY,
  CREAM,
  type Ctx,
  HAND,
  INK,
  INK_SOFT,
  ORANGE,
  WHITE,
  YELLOW,
  drawCover,
  drawPaw,
  fitFont,
  heart,
  loadFonts,
  loadImage,
  pawPattern,
  sketchBox,
  sparkle,
  star,
  textLines,
  withLetterSpacing,
  withRotation,
  withRotationAsync,
  wrapText,
} from './draw'
import { PETS_PER_THANKS_STORY, thanksMessage } from './thanks'

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

/** A mensagem do story: "{Nome}! Está pedindo para você ajudar o abrigo". */
const ASK = 'Está pedindo para você ajudar o abrigo'
/** Selo do topo de todos os modelos. */
const BADGE = 'Doe para o abrigo'
/** Deixa claro pra qual abrigo vai a doação. */
const SHELTER_PLACE = `${SHELTER.name} · Ivaiporã - PR`

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

/** Montagem 9:16 com até quatro fotos grandes e texto dentro da área segura dos Stories. */
export async function renderThanksStory(pets: Pet[], message: string, url: string, page = 1, total = 1): Promise<Blob> {
  if (!pets.length || pets.length > PETS_PER_THANKS_STORY) throw new Error('Selecione de 1 a 4 pets por story')
  await loadFonts()
  // Falhar permite tentar de novo; nunca compartilhar silenciosamente uma montagem sem uma foto.
  const photos = await Promise.all(pets.map((pet) => loadImage(pet.photo)))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, W, H)
  pawPattern(ctx, 'rgba(35,100,170,0.045)', W, H)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 28px ${BODY}`
  ctx.fillStyle = BLUE
  ctx.fillText('UMA CORRENTE DE CARINHO', W / 2, 228)
  const heading = thanksMessage(message)
  let size = 110
  let lines: string[] = []
  do {
    ctx.font = `${size}px ${HAND}`
    lines = textLines(ctx, heading, W - 152)
    if (lines.length * size <= 176) break
    size -= 2
  } while (size > 32)
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  lines.forEach((line, index) => ctx.fillText(line, W / 2, 258 + (176 - lines.length * size) / 2 + (index + 0.5) * size))

  const x = 54
  const y = 466
  const width = W - x * 2
  const height = 1052
  const gap = 22
  const halfW = (width - gap) / 2
  const halfH = (height - gap) / 2
  pets.forEach((pet, index) => {
    // Três fotos: uma maior em cima e duas embaixo, como na galeria.
    const columns = pets.length === 1 ? 1 : 2
    const isThree = pets.length === 3
    const col = isThree ? Math.max(0, index - 1) : index % columns
    const row = isThree ? (index === 0 ? 0 : 1) : Math.floor(index / columns)
    const cardX = x + col * (halfW + gap)
    const cardY = y + row * (halfH + gap)
    const cardW = columns === 1 || (isThree && index === 0) ? width : halfW
    const cardH = pets.length <= 2 ? height : halfH
    sketchBox(ctx, cardX, cardY, cardW, cardH, 28, WHITE, 4, 5)
    const photoX = cardX + 12
    const photoY = cardY + 12
    const photoW = cardW - 24
    const photoH = cardH - 76
    // A foto inteira fica em primeiro plano; o fundo desfocado preenche proporções diferentes.
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(photoX, photoY, photoW, photoH, 18)
    ctx.clip()
    ctx.filter = 'blur(22px)'
    drawCover(ctx, photos[index], photoX - 30, photoY - 30, photoW + 60, photoH + 60)
    ctx.filter = 'none'
    const scale = Math.min(photoW / photos[index].width, photoH / photos[index].height)
    const imageW = photos[index].width * scale
    const imageH = photos[index].height * scale
    ctx.drawImage(photos[index], photoX + (photoW - imageW) / 2, photoY + (photoH - imageH) / 2, imageW, imageH)
    ctx.restore()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = INK
    ctx.font = `700 ${fitFont(ctx, pet.name, BODY, '700', 38, 22, cardW - 100)}px ${BODY}`
    ctx.fillText(pet.name, cardX + 24, cardY + cardH - 32, cardW - 100)
    heart(ctx, cardX + cardW - 38, cardY + cardH - 32, 23, { fill: ORANGE })
  })

  // Rodapé compacto para deixar a maior parte da área útil para as fotos.
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = BLUE
  ctx.font = `68px ${HAND}`
  ctx.fillText('Faça a sua parte também!', 60, 1592, 736)
  ctx.fillStyle = INK_SOFT
  ctx.font = `400 28px ${BODY}`
  ctx.fillText(`${SHELTER.name} · ${new URL(url).host}`, 60, 1640, 730)
  await qrSticker(ctx, url, 942, 1612, 138, 0)
  if (total > 1) {
    ctx.fillStyle = INK_SOFT
    ctx.textAlign = 'center'
    ctx.font = `700 24px ${BODY}`
    ctx.fillText(`${page} / ${total}`, W / 2, 1714)
  }
  footerHandle(ctx, INK_SOFT)
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem')), 'image/jpeg', 0.94,
  ))
}

// =====================================================================
// 1) Foto — o pet em tela cheia, card com convite + QR embaixo
// =====================================================================

async function drawFoto(ctx: Ctx, pet: Pet, photo: HTMLImageElement | null, url: string) {
  ctx.fillStyle = ORANGE
  ctx.fillRect(0, 0, W, H)
  if (photo) drawCover(ctx, photo, 0, 0, W, H)
  else pawPattern(ctx, 'rgba(255,255,255,0.18)', W, H)

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
  pawPattern(ctx, 'rgba(35,100,170,0.13)', W, H)

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
  pawPattern(ctx, 'rgba(255,255,255,0.08)', W, H)

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

// =====================================================================
// Utilitários
// =====================================================================

/** Número "de registro" estável, tirado do id do pet. */
function cardNumber(id: string) {
  const hex = id.match(/([0-9a-f]{4,})$/)?.[1] ?? '0'
  return String(parseInt(hex.slice(0, 6), 16) % 10000).padStart(4, '0')
}

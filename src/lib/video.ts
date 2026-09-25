import QRCode from 'qrcode'
import { SHELTER, type Pet } from '../data/mock'
import {
  BLUE,
  BODY,
  CREAM,
  CREAM_DEEP,
  type Ctx,
  HAND,
  INK,
  INK_SOFT,
  ORANGE,
  TEAL,
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
} from './draw'
import { thanksMessage } from './thanks'

/**
 * Vídeo de agradecimento: os pets que já ajudaram vão aparecendo um por um, com carinhas
 * saltando na tela, coraçõezinhos subindo e, no fim, o convite com QR Code.
 *
 * Aqui só mora a animação: a cena é montada uma vez (fotos, QR e cards já desenhados em
 * canvas próprios) e depois `drawFrame(ctx, t)` desenha o instante `t` — sem nada assíncrono,
 * porque quem chama precisa disso quadro a quadro (prévia em tela e `encode.ts`).
 */

export type VideoFormat = 'reels' | 'feed'

export const VIDEO_FORMATS: { id: VideoFormat; label: string; hint: string; width: number; height: number }[] = [
  { id: 'reels', label: 'Reels e Stories', hint: '9:16 · tela cheia', width: 1080, height: 1920 },
  { id: 'feed', label: 'Feed', hint: '4:5 · post no perfil', width: 1080, height: 1350 },
]

/** Mais que isso e cada pet fica pequeno demais na tela — melhor fazer um segundo vídeo. */
export const PETS_PER_VIDEO = 24

export const VIDEO_FPS = 30

/** Tempo até o primeiro pet entrar (selo + mensagem à mão). */
const INTRO = 1.7
/** Duração da entrada de cada card. */
const APPEAR = 0.8
/** Quanto o convite final fica na tela. */
const OUTRO = 3.4

export interface ThanksScene {
  width: number
  height: number
  fps: number
  /** Duração total, em segundos. */
  duration: number
  /** Desenha o quadro do instante `t` (segundos). Só chame depois da cena montada. */
  drawFrame: (ctx: Ctx, t: number) => void
}

export interface SceneOptions {
  pets: Pet[]
  message: string
  /** Endereço que vai no QR Code. */
  url: string
  format: VideoFormat
}

export async function createThanksScene({ pets, message, url, format }: SceneOptions): Promise<ThanksScene> {
  if (!pets.length) throw new Error('Escolha pelo menos um pet')
  if (pets.length > PETS_PER_VIDEO) throw new Error(`Escolha no máximo ${PETS_PER_VIDEO} pets por vídeo`)

  const { width: W, height: H } = VIDEO_FORMATS.find((f) => f.id === format)!
  await loadFonts()
  // Falhar aqui permite tentar de novo; nunca publicar uma homenagem com um pet sem foto.
  const photos = await Promise.all(pets.map((pet) => loadImage(pet.photo)))
  const qr = await renderQr(url)

  const stage = layout(W, H, format, pets.length)
  const cards = pets.map((pet, index) => buildCard(pet, photos[index], stage.cellW, stage.cellH))
  const background = buildBackground(W, H)

  const stagger = pets.length <= 6 ? 0.68 : pets.length <= 12 ? 0.46 : 0.3
  // Instante em que cada card termina de assentar — é quando o contador sobe.
  const landings = pets.map((_, index) => INTRO + index * stagger + APPEAR * 0.55)
  const footerAt = INTRO + (pets.length - 1) * stagger + APPEAR + 0.3
  const duration = Math.round((footerAt + OUTRO) * 10) / 10

  const heading = thanksMessage(message)
  const title = fitTitle(heading, stage.titleW, stage.titleH)
  const hearts = floatingHearts(W, H)
  const bursts = pets.map((_, index) => burstSeeds(index))
  const host = new URL(url).host

  function drawFrame(ctx: Ctx, t: number) {
    // Fundo rolando devagarinho pra cima: dá vida sem roubar atenção das fotos.
    const drift = ((t * 14) % H + H) % H
    ctx.drawImage(background, 0, drift - H)
    ctx.drawImage(background, 0, drift)

    drawHearts(ctx, hearts, t, W, H)
    drawHeader(ctx, t, stage, title, landings)

    // No fim a turma recua pra caber inteira acima do convite que entra por baixo.
    const closing = settle(clamp01((t - footerAt) / 0.9))
    ctx.save()
    if (closing > 0) {
      const shrink = 1 - closing * (1 - stage.endScale)
      ctx.translate(W / 2, stage.cardsTop)
      ctx.scale(shrink, shrink)
      ctx.translate(-W / 2, -stage.cardsTop)
    }

    pets.forEach((_, index) => {
      const appearAt = INTRO + index * stagger
      const progress = clamp01((t - appearAt) / APPEAR)
      if (progress <= 0) return
      const slot = stage.slots[index]
      const card = cards[index]
      // Sobe com molinha e passa um tiquinho do ponto final antes de assentar.
      const grow = settle(progress)
      const spin = card.tilt + (1 - easeOutCubic(progress)) * card.entryTilt
      const breathe = Math.sin(t * 1.25 + card.phase) * (stage.cellH * 0.008)
      const sway = Math.sin(t * 0.85 + card.phase) * 0.7
      ctx.save()
      ctx.globalAlpha = Math.min(1, progress * 4)
      ctx.translate(slot.cx, slot.cy + breathe + (1 - grow) * stage.cellH * 0.25)
      ctx.rotate(((spin + sway) * Math.PI) / 180)
      const scale = 0.55 + grow * 0.45
      ctx.scale(scale, scale)
      ctx.drawImage(card.canvas, -card.canvas.width / 2, -card.canvas.height / 2)
      ctx.restore()
      ctx.globalAlpha = 1
      drawBurst(ctx, bursts[index], slot.cx, slot.cy, stage.cellW, t - (appearAt + APPEAR * 0.45))
    })
    ctx.restore()

    drawFooter(ctx, t - footerAt, stage, qr, host, W, H)
  }

  return { width: W, height: H, fps: VIDEO_FPS, duration, drawFrame }
}

// =====================================================================
// Onde cada coisa fica na tela
// =====================================================================

interface Slot {
  cx: number
  cy: number
}

interface Stage {
  W: number
  H: number
  slots: Slot[]
  cellW: number
  cellH: number
  /** Linha de base do selo do topo. */
  badgeY: number
  titleY: number
  titleW: number
  titleH: number
  counterY: number
  footerY: number
  footerH: number
  /** Topo da área das fotos — âncora do recuo da turma no fim do vídeo. */
  cardsTop: number
  /** Quanto a turma encolhe pra caber inteira acima do convite final. */
  endScale: number
}

/**
 * Divide a área das fotos numa grade que deixe cada card o mais perto possível de 3:4.
 * Nos Reels o topo (~200px) e a base (~260px) ficam livres: é onde o Instagram põe a
 * própria interface.
 */
function layout(W: number, H: number, format: VideoFormat, count: number): Stage {
  const margin = 56
  const reels = format === 'reels'
  const badgeY = (reels ? 236 : 96) + 16
  const titleY = badgeY + 52
  const titleH = reels ? 190 : 170
  const counterY = titleY + titleH + 44
  const footerH = reels ? 268 : 244
  // O convite entra por cima das fotos no fim do vídeo: assim os pets ficam com a tela toda.
  const footerY = H - (reels ? 250 : 88) - footerH
  const areaTop = counterY + 44
  const areaBottom = H - (reels ? 250 : 88)
  const areaW = W - margin * 2
  const areaH = areaBottom - areaTop

  let best = { cols: 1, rows: count, score: Infinity }
  let fallback = { cols: 1, rows: count, score: Infinity }
  for (let cols = 1; cols <= Math.min(5, count); cols++) {
    const rows = Math.ceil(count / cols)
    const gap = gapFor(cols)
    const cellW = (areaW - gap * (cols - 1)) / cols
    const cellH = (areaH - gap * (rows - 1)) / rows
    const score = Math.abs(cellW / cellH - 0.78)
    if (score < fallback.score) fallback = { cols, rows, score }
    // Card pequeno demais não dá pra ver quem é o pet.
    if (cellW < 140 || cellH < 140) continue
    if (score < best.score) best = { cols, rows, score }
  }

  const { cols, rows } = best.score === Infinity ? fallback : best
  const gap = gapFor(cols)
  const cellW = (areaW - gap * (cols - 1)) / cols
  const cellH = (areaH - gap * (rows - 1)) / rows
  const slots: Slot[] = []
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / cols)
    const inRow = Math.min(cols, count - row * cols)
    // Última fileira incompleta fica centralizada, sem buraco na ponta.
    const rowW = inRow * cellW + gap * (inRow - 1)
    const x = (W - rowW) / 2 + (index - row * cols) * (cellW + gap)
    slots.push({ cx: x + cellW / 2, cy: areaTop + row * (cellH + gap) + cellH / 2 })
  }

  return {
    W,
    H,
    slots,
    cellW,
    cellH,
    badgeY,
    titleY,
    titleW: W - 150,
    titleH,
    counterY,
    footerY,
    footerH,
    cardsTop: areaTop,
    endScale: Math.min(1, (footerY - 24 - areaTop) / (areaBottom - areaTop)),
  }
}

const gapFor = (cols: number) => (cols <= 2 ? 26 : cols === 3 ? 20 : 16)

// =====================================================================
// Peças montadas uma única vez
// =====================================================================

interface Card {
  canvas: HTMLCanvasElement
  /** Inclinação final do card (cada um torto pro seu lado). */
  tilt: number
  /** Inclinação extra na entrada, que vai desaparecendo. */
  entryTilt: number
  phase: number
}

/** Cada pet é desenhado uma vez no seu próprio canvas: no vídeo é só posicionar e girar. */
function buildCard(pet: Pet, photo: HTMLImageElement, cellW: number, cellH: number): Card {
  const stroke = clamp(cellW / 110, 3, 6)
  const shadow = stroke + 3
  const pad = Math.ceil(shadow + 4)
  const radius = clamp(cellW * 0.07, 14, 30)
  const captionH = clamp(cellH * 0.15, 44, 86)

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(cellW) + pad * 2
  canvas.height = Math.ceil(cellH) + pad * 2
  const ctx = canvas.getContext('2d')!
  ctx.lineJoin = 'round'
  ctx.translate(pad, pad)
  sketchBox(ctx, 0, 0, cellW, cellH, radius, WHITE, stroke, shadow)

  const inset = clamp(cellW * 0.035, 8, 14)
  const photoW = cellW - inset * 2
  const photoH = cellH - captionH - inset
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(inset, inset, photoW, photoH, radius * 0.6)
  ctx.clip()
  // A foto inteira fica em primeiro plano; o fundo desfocado preenche proporções diferentes.
  ctx.filter = 'blur(20px)'
  drawCover(ctx, photo, inset - 26, inset - 26, photoW + 52, photoH + 52)
  ctx.filter = 'none'
  const scale = Math.min(photoW / photo.width, photoH / photo.height)
  const imageW = photo.width * scale
  const imageH = photo.height * scale
  ctx.drawImage(photo, inset + (photoW - imageW) / 2, inset + (photoH - imageH) / 2, imageW, imageH)
  ctx.restore()

  const nameSize = fitFont(ctx, pet.name, BODY, '700', captionH * 0.5, 16, cellW - captionH - inset * 2)
  ctx.font = `700 ${nameSize}px ${BODY}`
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(pet.name, inset + 4, cellH - captionH / 2 - 2, cellW - captionH)
  heart(ctx, cellW - inset - captionH * 0.28, cellH - captionH / 2 - 2, captionH * 0.52, { fill: ORANGE })

  const random = seeded(hash(pet.id))
  return {
    canvas,
    tilt: (random() - 0.5) * 6,
    entryTilt: (random() < 0.5 ? -1 : 1) * (10 + random() * 10),
    phase: random() * Math.PI * 2,
  }
}

/** Fundo creme com patinhas, desenhado uma vez e reaproveitado em todos os quadros. */
function buildBackground(W: number, H: number) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const glow = ctx.createLinearGradient(0, 0, W, H)
  glow.addColorStop(0, CREAM)
  glow.addColorStop(0.55, CREAM)
  glow.addColorStop(1, CREAM_DEEP)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  pawPattern(ctx, 'rgba(35,100,170,0.05)', W, H)
  return canvas
}

async function renderQr(url: string) {
  const canvas = document.createElement('canvas')
  await QRCode.toCanvas(canvas, url, {
    width: 240,
    margin: 0,
    errorCorrectionLevel: 'H', // aguenta a patinha no meio
    color: { dark: INK, light: WHITE },
  })
  return canvas
}

interface Title {
  lines: string[]
  size: number
}

/** Maior corpo de letra em que a mensagem inteira cabe na faixa reservada pro título. */
function fitTitle(text: string, maxW: number, maxH: number): Title {
  const ctx = document.createElement('canvas').getContext('2d')!
  let size = 128
  let lines: string[] = []
  do {
    ctx.font = `${size}px ${HAND}`
    lines = textLines(ctx, text, maxW)
    if (lines.length * size <= maxH) break
    size -= 3
  } while (size > 40)
  return { lines, size }
}

// =====================================================================
// Animação
// =====================================================================

/** Selo, mensagem à mão e o contador de pets que sobe conforme os cards entram. */
function drawHeader(ctx: Ctx, t: number, stage: Stage, title: Title, landings: number[]) {
  const { W } = stage
  ctx.textAlign = 'center'

  const badge = settle(clamp01((t - 0.1) / 0.6))
  if (badge > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, badge * 2)
    ctx.translate(W / 2, stage.badgeY)
    ctx.scale(0.8 + badge * 0.2, 0.8 + badge * 0.2)
    ctx.font = `700 30px ${BODY}`
    ctx.fillStyle = BLUE
    ctx.textBaseline = 'middle'
    withLetterSpacing(ctx, '4px', () => ctx.fillText('UMA CORRENTE DE CARINHO', 0, 0))
    ctx.restore()
  }

  // Cada linha da mensagem entra de baixo, uma atrás da outra.
  const top = stage.titleY + (stage.titleH - title.lines.length * title.size) / 2
  title.lines.forEach((line, index) => {
    const progress = settle(clamp01((t - (0.35 + index * 0.18)) / 0.7))
    if (progress <= 0) return
    ctx.save()
    ctx.globalAlpha = Math.min(1, progress * 2)
    ctx.font = `${title.size}px ${HAND}`
    ctx.fillStyle = INK
    ctx.textBaseline = 'middle'
    ctx.fillText(line, W / 2, top + (index + 0.5) * title.size + (1 - progress) * 34)
    ctx.restore()
  })

  // Contador: sobe junto com os cards e ganha um pulinho a cada pet novo.
  const shown = landings.filter((landing) => t >= landing).length
  if (shown <= 0) {
    ctx.textAlign = 'left'
    return
  }
  const pop = 1 + Math.max(0, 0.14 - (t - landings[shown - 1]) * 0.6)
  const text = `${shown} ${shown === 1 ? 'pet já ajudou' : 'pets já ajudaram'}`
  ctx.save()
  ctx.translate(W / 2, stage.counterY)
  ctx.scale(pop, pop)
  ctx.font = `700 34px ${BODY}`
  const w = ctx.measureText(text).width + 116
  sketchBox(ctx, -w / 2, -34, w, 68, 34, YELLOW, 5, 6)
  drawPaw(ctx, -w / 2 + 26, -18, 36, ORANGE)
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(text, -w / 2 + 74, 2)
  ctx.restore()
  ctx.textAlign = 'left'
}

/** Convite final: card creme com o QR, o endereço do site e o @ do abrigo. */
function drawFooter(ctx: Ctx, t: number, stage: Stage, qr: HTMLCanvasElement, host: string, W: number, H: number) {
  if (t <= 0) return
  const progress = settle(clamp01(t / 0.9))
  const x = 56
  const w = W - x * 2
  const h = stage.footerH
  const y = stage.footerY + (1 - progress) * (h + 120)

  // Véu creme atrás do convite: ele entra por cima das fotos e precisa se destacar.
  const veil = ctx.createLinearGradient(0, stage.footerY - 150, 0, H)
  veil.addColorStop(0, 'rgba(255,249,240,0)')
  veil.addColorStop(0.5, 'rgba(255,249,240,0.86)')
  veil.addColorStop(1, 'rgba(255,249,240,0.97)')
  ctx.save()
  ctx.globalAlpha = Math.min(1, progress * 1.6)
  ctx.fillStyle = veil
  ctx.fillRect(0, stage.footerY - 150, W, H - stage.footerY + 150)
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = Math.min(1, progress * 3)
  sketchBox(ctx, x, y, w, h, 40, CREAM, 6, 9)

  const qrSize = h - 92
  const qrX = x + w - qrSize - 44
  const qrY = y + (h - qrSize) / 2
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize)
  ctx.beginPath()
  ctx.roundRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 18)
  ctx.lineWidth = 5
  ctx.strokeStyle = INK
  ctx.stroke()
  const r = qrSize * 0.12
  ctx.beginPath()
  ctx.arc(qrX + qrSize / 2, qrY + qrSize / 2, r, 0, Math.PI * 2)
  ctx.fillStyle = WHITE
  ctx.fill()
  ctx.lineWidth = 4
  ctx.stroke()
  drawPaw(ctx, qrX + qrSize / 2 - r * 0.66, qrY + qrSize / 2 - r * 0.7, r * 1.32, ORANGE)

  const textW = qrX - 24 - (x + 44)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `${fitFont(ctx, 'Faça a sua parte também!', HAND, '', 82, 48, textW)}px ${HAND}`
  ctx.fillText('Faça a sua parte também!', x + 44, y + 104)
  ctx.fillStyle = INK_SOFT
  ctx.font = `700 ${fitFont(ctx, 'Aponte a câmera no QR 👉', BODY, '700', 32, 22, textW)}px ${BODY}`
  ctx.fillText('Aponte a câmera no QR 👉', x + 44, y + 156)
  ctx.font = `700 ${fitFont(ctx, host, BODY, '700', 30, 20, textW - 56)}px ${BODY}`
  const pillW = Math.min(ctx.measureText(host).width + 48, textW)
  sketchBox(ctx, x + 44, y + h - 96, pillW, 62, 31, BLUE, 5, 6)
  ctx.fillStyle = WHITE
  ctx.textBaseline = 'middle'
  ctx.fillText(host, x + 68, y + h - 63, pillW - 48)
  ctx.restore()

  // @ do abrigo logo abaixo do card (no story fica escondido pela caixa de resposta; no feed aparece)
  const handle = `@${SHELTER.instagram}`
  ctx.save()
  ctx.globalAlpha = Math.min(1, clamp01((t - 0.5) / 0.6))
  ctx.font = `700 30px ${BODY}`
  const icon = 32
  const handleW = icon + 12 + ctx.measureText(handle).width
  const handleY = stage.footerY + h + 46
  drawPaw(ctx, (W - handleW) / 2, handleY - icon / 2, icon, INK_SOFT)
  ctx.fillStyle = INK_SOFT
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(handle, (W - handleW) / 2 + icon + 12, handleY + 2)
  ctx.restore()
}

interface FloatingHeart {
  x: number
  size: number
  speed: number
  phase: number
  color: string
  sway: number
}

function floatingHearts(W: number, H: number): FloatingHeart[] {
  const random = seeded(7)
  const colors = [ORANGE, YELLOW, BLUE, TEAL]
  return Array.from({ length: 16 }, () => ({
    x: random() * W,
    size: 26 + random() * 52,
    speed: (H + 200) / (7 + random() * 6),
    phase: random(),
    color: colors[Math.floor(random() * colors.length)],
    sway: 18 + random() * 40,
  }))
}

/** Coraçõezinhos subindo no fundo, atrás dos cards. */
function drawHearts(ctx: Ctx, list: FloatingHeart[], t: number, W: number, H: number) {
  ctx.save()
  ctx.globalAlpha = 0.28
  for (const item of list) {
    const travel = H + item.size * 2
    const y = H + item.size - (((t + item.phase * 12) * item.speed) % travel)
    const x = item.x + Math.sin((t + item.phase * 10) * 0.8) * item.sway
    heart(ctx, ((x % W) + W) % W, y, item.size, { fill: item.color, rotate: Math.sin(t + item.phase * 6) * 14 })
  }
  ctx.restore()
}

interface BurstPiece {
  angle: number
  distance: number
  size: number
  kind: number
}

function burstSeeds(index: number): BurstPiece[] {
  const random = seeded(index * 31 + 5)
  return Array.from({ length: 7 }, (_, i) => ({
    angle: (Math.PI * 2 * i) / 7 + random() * 0.6,
    distance: 0.5 + random() * 0.45,
    size: 16 + random() * 18,
    kind: Math.floor(random() * 3),
  }))
}

/** Estrelinhas e corações saltando no momento em que o card assenta. */
function drawBurst(ctx: Ctx, pieces: BurstPiece[], cx: number, cy: number, cellW: number, t: number) {
  const progress = clamp01(t / 0.7)
  if (progress <= 0 || progress >= 1) return
  const out = easeOutCubic(progress)
  ctx.save()
  ctx.globalAlpha = 1 - progress
  for (const piece of pieces) {
    const radius = (cellW * 0.55 + out * cellW * 0.35) * piece.distance
    const x = cx + Math.cos(piece.angle) * radius
    const y = cy + Math.sin(piece.angle) * radius
    const size = piece.size * (1 - progress * 0.4)
    if (piece.kind === 0) heart(ctx, x, y, size, { fill: ORANGE })
    else if (piece.kind === 1) star(ctx, x, y, size * 0.55, YELLOW)
    else sparkle(ctx, x, y, size * 0.6, BLUE)
  }
  ctx.restore()
}

// =====================================================================
// Utilitários
// =====================================================================

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3

/** Molinha que passa do ponto e volta — a "cara" das animações do app. */
function settle(x: number) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return 1 - 2 ** (-8 * x) * Math.cos(10.5 * x)
}

/** Sorteio sempre igual pra mesma semente: a animação de um pet nunca muda entre prévia e vídeo. */
function seeded(seed: number) {
  let state = (seed * 9301 + 49297) % 233280
  return () => {
    state = (state * 9301 + 49297) % 233280
    return state / 233280
  }
}

function hash(text: string) {
  let value = 0
  for (const character of text) value = (value * 31 + character.charCodeAt(0)) % 100000
  return value
}


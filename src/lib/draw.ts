/**
 * Peças de desenho no canvas compartilhadas pelas imagens de story (`story.ts`)
 * e pelo vídeo de agradecimento (`video.ts`): paleta, patinhas, caixas, textos.
 */

export const INK = '#1a2b4a'
export const INK_SOFT = '#4a6080'
export const CREAM = '#fff9f0'
export const CREAM_DEEP = '#f6e9d5'
export const YELLOW = '#fec601'
export const ORANGE = '#ea7317'
export const BLUE = '#2364aa'
export const TEAL = '#73bfb8'
export const WHITE = '#ffffff'

export const HAND = '"Just Me Again Down Here"'
export const BODY = '"Balsamiq Sans"'

export type Ctx = CanvasRenderingContext2D

let fontsReady: Promise<unknown> | null = null

/** As fontes do app só existem no canvas depois de carregadas de verdade. */
export function loadFonts() {
  fontsReady ??= Promise.all([
    document.fonts.load(`150px ${HAND}`, 'Faça ÁÉÍÓÚ ãõç'),
    document.fonts.load(`700 40px ${BODY}`, 'Faça ÁÉÍÓÚ ãõç'),
    document.fonts.load(`400 36px ${BODY}`, 'Faça ÁÉÍÓÚ ãõç'),
  ])
  return fontsReady
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Caixa no estilo do app: contorno grosso escuro + sombra "dura" deslocada. */
export function sketchBox(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke: number, shadow: number) {
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
export function drawCover(ctx: Ctx, img: CanvasImageSource, x: number, y: number, w: number, h: number, r = 0) {
  const iw = 'naturalWidth' in img ? img.naturalWidth : (img as HTMLCanvasElement).width
  const ih = 'naturalHeight' in img ? img.naturalHeight : (img as HTMLCanvasElement).height
  const scale = Math.max(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale
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

export function drawPaw(ctx: Ctx, x: number, y: number, size: number, color: string) {
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

/** Patinhas tortas cobrindo a área toda (fundo dos modelos). */
export function pawPattern(ctx: Ctx, color: string, w: number, h: number) {
  for (let row = 0; row <= Math.ceil(h / 190); row++) {
    for (let col = 0; col <= Math.ceil(w / 200); col++) {
      withRotation(ctx, col * 200 + (row % 2) * 100 + 40, row * 190 + 60, row % 2 ? 18 : -18, () =>
        drawPaw(ctx, -34, -34, 68, color),
      )
    }
  }
}

export function heart(ctx: Ctx, cx: number, cy: number, s: number, opts: { fill?: string; stroke?: string; lineWidth?: number; rotate?: number }) {
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

export function star(ctx: Ctx, cx: number, cy: number, r: number, fill: string) {
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
export function sparkle(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.quadraticCurveTo(cx, cy, cx + r, cy)
  ctx.quadraticCurveTo(cx, cy, cx, cy + r)
  ctx.quadraticCurveTo(cx, cy, cx - r, cy)
  ctx.quadraticCurveTo(cx, cy, cx, cy - r)
  ctx.fillStyle = color
  ctx.fill()
}

export function withRotation(ctx: Ctx, cx: number, cy: number, deg: number, draw: () => void) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((deg * Math.PI) / 180)
  draw()
  ctx.restore()
}

export async function withRotationAsync(ctx: Ctx, cx: number, cy: number, deg: number, draw: () => Promise<void>) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((deg * Math.PI) / 180)
  await draw()
  ctx.restore()
}

export function withLetterSpacing(ctx: Ctx, spacing: string, draw: () => void) {
  const prev = ctx.letterSpacing
  ctx.letterSpacing = spacing
  draw()
  ctx.letterSpacing = prev
}

/** Maior tamanho de fonte (entre max e min) em que o texto cabe na largura. */
export function fitFont(ctx: Ctx, text: string, family: string, weight: string, max: number, min: number, maxW: number) {
  let size = max
  ctx.font = `${weight} ${size}px ${family}`.trim()
  while (ctx.measureText(text).width > maxW && size > min) {
    size -= 4
    ctx.font = `${weight} ${size}px ${family}`.trim()
  }
  return size
}

export function wrapText(ctx: Ctx, text: string, x: number, y: number, maxW: number, lineH: number) {
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

/** Quebra inclusive palavras longas, para mensagens personalizadas nunca vazarem sobre as fotos. */
export function textLines(ctx: Ctx, text: string, maxWidth: number) {
  const lines: string[] = []
  let line = ''
  for (const character of text.replace(/\s+/g, ' ')) {
    if (ctx.measureText(line + character).width > maxWidth && line) {
      const space = line.lastIndexOf(' ')
      lines.push(space > 0 ? line.slice(0, space) : line)
      line = space > 0 ? line.slice(space + 1) : ''
    }
    line += character
  }
  if (line.trim()) lines.push(line.trim())
  return lines
}

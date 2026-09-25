import { ArrayBufferTarget, Muxer } from 'mp4-muxer'

/**
 * Transforma uma animação desenhada no canvas em arquivo de vídeo pra postar no Instagram.
 *
 * Caminho principal (WebCodecs + mp4-muxer): desenha quadro por quadro fora do tempo real e
 * monta um MP4/H.264 — o formato que o Instagram aceita. Roda em Chrome/Edge/Android e no
 * Safari 16.4+, é mais rápido que a duração do vídeo e nunca perde quadro.
 *
 * Plano B (MediaRecorder): grava a animação tocando em tempo real. Alguns navegadores só
 * gravam WebM, que o Instagram não aceita — por isso o resultado diz qual formato saiu, pra
 * tela avisar a pessoa.
 */

export type EncodeMode = 'webcodecs' | 'recorder'

export interface EncodedVideo {
  blob: Blob
  /** Extensão do arquivo, sem ponto. */
  ext: 'mp4' | 'webm'
  mode: EncodeMode
}

export interface EncodeOptions {
  width: number
  height: number
  fps: number
  /** Duração total em segundos. */
  duration: number
  /** Desenha o quadro do instante `t` (em segundos) no contexto. */
  draw: (ctx: CanvasRenderingContext2D, t: number) => void
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}

/** Perfis H.264 do mais pro menos capaz: o primeiro que o aparelho aceitar é o usado. */
const AVC_CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640033', 'avc1.42001f']

/** Formatos do MediaRecorder em ordem de preferência (MP4 primeiro: é o que o Instagram quer). */
const RECORDER_MIMES = [
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

const aborted = () => new DOMException('Geração cancelada', 'AbortError')

export async function encodeVideo(options: EncodeOptions): Promise<EncodedVideo> {
  const canvas = document.createElement('canvas')
  canvas.width = options.width
  canvas.height = options.height
  // `alpha: false` deixa o desenho mais rápido; o fundo é opaco de qualquer jeito.
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Este navegador não suporta desenhar o vídeo')
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  const config = await pickAvcConfig(options)
  if (config) {
    try {
      return await encodeWithWebCodecs(canvas, ctx, config, options)
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error
      console.warn('[vídeo] WebCodecs falhou, gravando em tempo real', error)
    }
  }
  return await recordInRealTime(canvas, ctx, options)
}

/** Quanto de dados por segundo: ~8 Mbps num 1080×1920, proporcional em outros tamanhos. */
function bitrateFor(width: number, height: number) {
  return Math.round(Math.min(12e6, Math.max(4e6, (width * height) / 259)))
}

async function pickAvcConfig({ width, height, fps }: EncodeOptions): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === 'undefined') return null
  for (const codec of AVC_CODECS) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate: bitrateFor(width, height),
      framerate: fps,
      // O mp4-muxer precisa do H.264 no formato AVCC (e não em Annex B).
      avc: { format: 'avc' },
      latencyMode: 'quality',
    }
    try {
      const { supported } = await VideoEncoder.isConfigSupported(config)
      if (supported) return config
    } catch {
      /* string de codec que este navegador nem reconhece — tenta a próxima */
    }
  }
  return null
}

async function encodeWithWebCodecs(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  config: VideoEncoderConfig,
  { fps, duration, draw, onProgress, signal }: EncodeOptions,
): Promise<EncodedVideo> {
  const frames = Math.max(1, Math.round(duration * fps))
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: config.width, height: config.height, frameRate: fps },
    fastStart: 'in-memory',
  })

  let failure: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => (failure ??= error),
  })
  encoder.configure(config)

  try {
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw aborted()
      if (failure) throw failure
      draw(ctx, i / fps)
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((i * 1e6) / fps),
        duration: Math.round(1e6 / fps),
      })
      // Um quadro-chave a cada 2s: o Instagram e as prévias conseguem buscar qualquer ponto.
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
      frame.close()
      // Sem isso a fila do codificador estoura a memória em vídeos longos.
      while (encoder.encodeQueueSize > 8 && !failure) await nextTick()
      onProgress?.(((i + 1) / frames) * 0.92)
      // Devolve o controle pro navegador de vez em quando: a barra de progresso anda e o app não trava.
      if (i % 4 === 3) await nextTick()
    }
    await encoder.flush()
    if (failure) throw failure
    muxer.finalize()
    onProgress?.(1)
    return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4', mode: 'webcodecs' }
  } finally {
    if (encoder.state !== 'closed') encoder.close()
  }
}

/**
 * Plano B: toca a animação no canvas e grava a tela dele em tempo real. Mais lento (leva a
 * duração do vídeo) e pode sair em WebM, mas funciona onde não tem WebCodecs.
 */
function recordInRealTime(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  { fps, duration, draw, onProgress, signal }: EncodeOptions,
): Promise<EncodedVideo> {
  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
    return Promise.reject(new Error('Este navegador não consegue gerar o vídeo — tente pelo Chrome'))
  }
  const mimeType = RECORDER_MIMES.find((mime) => MediaRecorder.isTypeSupported(mime))
  if (!mimeType) return Promise.reject(new Error('Este navegador não consegue gerar o vídeo — tente pelo Chrome'))

  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrateFor(canvas.width, canvas.height) })
  const parts: Blob[] = []
  recorder.ondataavailable = (event) => event.data.size > 0 && parts.push(event.data)

  return new Promise<EncodedVideo>((resolve, reject) => {
    let raf = 0
    const stop = () => {
      cancelAnimationFrame(raf)
      if (recorder.state !== 'inactive') recorder.stop()
      stream.getTracks().forEach((track) => track.stop())
    }
    const onAbort = () => {
      stop()
      reject(aborted())
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    recorder.onerror = () => {
      stop()
      reject(new Error('Falha ao gravar o vídeo — tente de novo'))
    }
    recorder.onstop = () => {
      signal?.removeEventListener('abort', onAbort)
      if (signal?.aborted) return
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'
      onProgress?.(1)
      resolve({ blob: new Blob(parts, { type: mimeType }), ext, mode: 'recorder' })
    }

    draw(ctx, 0)
    recorder.start(1000)
    const start = performance.now()
    const tick = () => {
      if (signal?.aborted) return
      const t = (performance.now() - start) / 1000
      if (t >= duration) {
        draw(ctx, duration)
        onProgress?.(1)
        // Deixa o último quadro entrar no arquivo antes de fechar.
        setTimeout(stop, 120)
        return
      }
      draw(ctx, t)
      onProgress?.(t / duration)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  })
}

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0))

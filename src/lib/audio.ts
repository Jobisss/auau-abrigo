import type { SceneCues } from './video'

/**
 * Trilha do vídeo de agradecimento: um som a cada pet que salta na tela e um maior
 * na comemoração, quando a turma toda aparece.
 *
 * Os arquivos ficam em `public/sons/` e são opcionais — sem eles o vídeo sai mudo,
 * exatamente como antes. A mixagem é feita fora do tempo real (`OfflineAudioContext`),
 * então o áudio já sai alinhado com a animação, quadro a quadro.
 */

export type SoundId = 'pet' | 'festa'

/** Primeiro arquivo que existir vale; assim o abrigo põe o som no formato que tiver. */
const SOURCES: Record<SoundId, string[]> = {
  pet: ['/sons/pet.mp3', '/sons/pet.m4a', '/sons/pet.wav', '/sons/pet.ogg'],
  festa: ['/sons/festa.mp3', '/sons/festa.m4a', '/sons/festa.wav', '/sons/festa.ogg'],
}

const SAMPLE_RATE = 48000

/**
 * Altura de cada som depois de normalizado (1 = o máximo que cabe sem distorcer).
 * Os arquivos vêm com volumes bem diferentes, então o app iguala os dois e só então
 * aplica essa proporção: o som de cada pet não pode abafar a comemoração.
 */
const LEVEL: Record<SoundId, number> = { pet: 0.45, festa: 0.85 }

export type Sounds = Record<SoundId, AudioBuffer | null>

let cache: Promise<Sounds> | null = null

/** Carrega os sons uma vez por sessão. Arquivo ausente ou ilegível vira `null`. */
export function loadSounds() {
  cache ??= Promise.all([decodeFirst(SOURCES.pet), decodeFirst(SOURCES.festa)]).then(([pet, festa]) => ({ pet, festa }))
  return cache
}

export const hasSound = (sounds: Sounds) => Boolean(sounds.pet || sounds.festa)

/**
 * Mixa os sons nos instantes da cena e devolve a trilha inteira.
 * `null` quando não há nenhum arquivo de som instalado.
 */
export async function renderSceneAudio(sounds: Sounds, cues: SceneCues, duration: number): Promise<AudioBuffer | null> {
  if (!hasSound(sounds)) return null
  // Só estica o arquivo se o som da comemoração passar do fim da animação — aí vale
  // segurar o último quadro mais um tiquinho em vez de cortar o som no meio.
  const festaEnd = cues.festa + (sounds.festa?.duration ?? 0)
  const tail = Math.min(1.5, Math.max(0, festaEnd - duration))
  const length = Math.ceil((duration + tail) * SAMPLE_RATE)
  const ctx = new OfflineAudioContext(2, length, SAMPLE_RATE)
  const master = ctx.createGain()
  master.gain.value = 1
  // Segura os picos de quando vários sons caem quase juntos (turma grande, um a cada 0,3s).
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.knee.value = 6
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.12
  master.connect(limiter).connect(ctx.destination)

  const place = (buffer: AudioBuffer | null, at: number, id: SoundId) => {
    if (!buffer || at >= duration) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = LEVEL[id] / peakOf(buffer)
    source.connect(gain).connect(master)
    source.start(Math.max(0, at))
  }

  cues.pet.forEach((at) => place(sounds.pet, at, 'pet'))
  place(sounds.festa, cues.festa, 'festa')

  return await ctx.startRendering()
}

/** Pico do arquivo, pra igualar sons gravados em volumes diferentes. */
function peakOf(buffer: AudioBuffer) {
  let peak = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i++) {
      const value = Math.abs(data[i])
      if (value > peak) peak = value
    }
  }
  // Arquivo praticamente mudo não vira ganho gigante.
  return Math.max(peak, 0.08)
}

async function decodeFirst(urls: string[]): Promise<AudioBuffer | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url)
      if (!response.ok) continue
      // Arquivo inexistente cai no index.html do SPA: o decode falha e a gente segue.
      const data = await response.arrayBuffer()
      return await decodeContext().decodeAudioData(data)
    } catch {
      /* formato não suportado ou arquivo ausente — tenta o próximo */
    }
  }
  return null
}

let decoder: OfflineAudioContext | null = null
/** Decodificar não precisa de um contexto tocando (nem do toque do usuário). */
function decodeContext() {
  decoder ??= new OfflineAudioContext(1, 1, SAMPLE_RATE)
  return decoder
}

// =====================================================================
// Som da prévia na tela
// =====================================================================

export interface CuePlayer {
  /** Toca a trilha da cena começando agora. */
  play: (buffer: AudioBuffer) => void
  stop: () => void
  close: () => void
}

/**
 * Toca a trilha junto com a prévia. O navegador só libera som depois de um toque na
 * página — como a pessoa clica nos pets antes, quando chega aqui já está liberado.
 */
export function createCuePlayer(): CuePlayer {
  const ctx = new AudioContext()
  let source: AudioBufferSourceNode | null = null
  const stop = () => {
    source?.stop()
    source?.disconnect()
    source = null
  }
  return {
    play(buffer) {
      stop()
      if (ctx.state === 'suspended') void ctx.resume()
      source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start()
    },
    stop,
    close() {
      stop()
      void ctx.close()
    },
  }
}

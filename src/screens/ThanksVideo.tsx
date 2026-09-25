import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Clapperboard, PawPrint, RotateCcw, Square, Volume2, VolumeX, Wand2 } from 'lucide-react'
import { ScreenHeader, haptic } from '../components/ui'
import { StoryShareActions, type ShareableStory } from '../components/StoryShareActions'
import { SHELTER, type Pet } from '../data/mock'
import { track } from '../lib/analytics'
import { ApiError, api } from '../lib/api'
import { createCuePlayer, hasSound, loadSounds, renderSceneAudio, type CuePlayer } from '../lib/audio'
import { encodeVideo, type EncodeMode } from '../lib/encode'
import { DEFAULT_THANKS_MESSAGE, thanksMessage } from '../lib/thanks'
import { PETS_PER_VIDEO, VIDEO_FORMATS, createThanksScene, type ThanksScene, type VideoFormat } from '../lib/video'
import { useApp } from '../state/AppState'

/** Prévia em meia resolução: mesma animação do arquivo final, com metade do trabalho. */
const PREVIEW_SCALE = 0.5

interface Result {
  story: ShareableStory
  ext: 'mp4' | 'webm'
  mode: EncodeMode
  hasAudio: boolean
}

/**
 * Monta um vídeo de agradecimento pros pets que já ajudaram: escolhe a turma, vê a animação
 * rodando e exporta o arquivo pra postar no Instagram.
 */
export default function ThanksVideo() {
  const [searchParams] = useSearchParams()
  const { pets: feed, feedStatus, reloadFeed } = useApp()
  useEffect(reloadFeed, [reloadFeed])

  const prefillIds = useMemo(
    () => [...new Set((searchParams.get('pets') ?? '').split(',').map((id) => id.trim()).filter(Boolean))],
    [searchParams],
  )
  const [extras, setExtras] = useState<Pet[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>(prefillIds.slice(0, PETS_PER_VIDEO))
  const [message, setMessage] = useState(() => thanksMessage(searchParams.get('mensagem')))
  const [format, setFormat] = useState<VideoFormat>('reels')

  // Pets indicados no link que já saíram do feed (ele traz só os mais recentes).
  useEffect(() => {
    const missing = prefillIds.filter((id) => !feed.some((pet) => pet.id === id))
    if (feedStatus !== 'ready' || !missing.length) return
    let alive = true
    Promise.all(
      missing.map((id) =>
        api.pets.get(id).catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return null
          throw error
        }),
      ),
    )
      .then((list) => alive && setExtras(list.filter((pet): pet is Pet => pet !== null)))
      .catch(() => {
        /* sem eles a pessoa ainda escolhe do feed */
      })
    return () => {
      alive = false
    }
  }, [prefillIds, feed, feedStatus])

  const available = useMemo(() => {
    const byId = new Map<string, Pet>()
    for (const pet of [...extras, ...feed]) byId.set(pet.id, pet)
    return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt)
  }, [feed, extras])

  // A ordem da seleção é a ordem em que os pets aparecem no vídeo.
  const selected = useMemo(
    () => selectedIds.map((id) => available.find((pet) => pet.id === id)).filter((pet): pet is Pet => Boolean(pet)),
    [selectedIds, available],
  )

  const full = selected.length >= PETS_PER_VIDEO

  function toggle(id: string) {
    haptic()
    setSelectedIds((ids) => {
      if (ids.includes(id)) return ids.filter((value) => value !== id)
      if (ids.length >= PETS_PER_VIDEO) return ids
      return [...ids, id]
    })
  }

  return (
    <main className="screen video-screen">
      <ScreenHeader title="Vídeo de agradecimento" />
      <p className="muted video-lead">
        Escolha os bichinhos e eles vão aparecendo um por um, com a sua mensagem. No fim você baixa o vídeo e posta no
        Instagram.
      </p>

      <section className="stack" style={{ '--gap': '10px' } as CSSProperties} aria-label="Escolher os pets">
        <div className="video-section-head">
          <span className="label">1. Quem vai aparecer</span>
          <span className="muted">
            {selected.length}/{PETS_PER_VIDEO}
          </span>
        </div>
        {feedStatus === 'loading' && available.length === 0 && (
          <div className="video-pet-grid" role="status" aria-label="Carregando os pets">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="video-pet skeleton" />
            ))}
          </div>
        )}
        {feedStatus === 'error' && available.length === 0 && (
          <div className="video-empty" role="alert">
            <PawPrint size={26} />
            <p>Não deu pra carregar os pets. Confira a conexão.</p>
            <button className="pill" onClick={reloadFeed}>
              Tentar de novo
            </button>
          </div>
        )}
        {available.length > 0 && (
          <div className="video-pet-grid">
            {available.map((pet) => {
              const order = selectedIds.indexOf(pet.id)
              const chosen = order >= 0
              return (
                <button
                  key={pet.id}
                  type="button"
                  className={`video-pet ${chosen ? 'is-selected' : ''}`}
                  aria-pressed={chosen}
                  disabled={!chosen && full}
                  onClick={() => toggle(pet.id)}
                >
                  <img src={pet.photo} alt="" loading="lazy" />
                  <span className="video-pet-name">{pet.name}</span>
                  {chosen && <span className="video-pet-badge">{order + 1}</span>}
                </button>
              )
            })}
          </div>
        )}
        {full && <p className="hint-text">Máximo de {PETS_PER_VIDEO} pets por vídeo — faça outro com o resto da turma.</p>}
        {selected.length > 0 && (
          <button className="pill pill--sm" onClick={() => setSelectedIds([])}>
            Limpar seleção
          </button>
        )}
      </section>

      <label className="stack" style={{ '--gap': '6px' } as CSSProperties}>
        <span className="label">2. Mensagem do vídeo</span>
        <textarea
          className="input"
          value={message}
          maxLength={120}
          rows={2}
          placeholder={DEFAULT_THANKS_MESSAGE}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>

      <section className="stack" style={{ '--gap': '8px' } as CSSProperties}>
        <span className="label">3. Formato do post</span>
        <div className="row" style={{ '--gap': '8px' } as CSSProperties} role="radiogroup" aria-label="Formato do vídeo">
          {VIDEO_FORMATS.map((option) => (
            <button
              key={option.id}
              className="pill grow video-format"
              role="radio"
              aria-checked={format === option.id}
              onClick={() => setFormat(option.id)}
            >
              {option.label}
              <span className="video-format-hint">{option.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <VideoStudio pets={selected} message={message} format={format} />
    </main>
  )
}

/** Prévia animada + geração do arquivo. Remontado do zero quando a escolha muda. */
function VideoStudio({ pets, message, format }: { pets: Pet[]; message: string; format: VideoFormat }) {
  const [scene, setScene] = useState<ThanksScene | null>(null)
  const [status, setStatus] = useState<'vazio' | 'montando' | 'pronto' | 'erro'>('vazio')
  const [result, setResult] = useState<Result | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const busy = progress > 0
  const abortRef = useRef<AbortController | null>(null)
  const [playKey, setPlayKey] = useState(0)
  const [audio, setAudio] = useState<AudioBuffer | null>(null)
  const [muted, setMuted] = useState(false)
  const playerRef = useRef<CuePlayer | null>(null)

  const petKey = pets.map((pet) => `${pet.id}:${pet.photo}`).join(',')
  const url = `${location.origin}/`

  // Remonta a cena (fotos, cards e QR já desenhados) quando a escolha muda — com uma
  // pausinha pra quem está clicando em vários pets seguidos não montar tudo a cada clique.
  const petsRef = useRef(pets)
  petsRef.current = pets
  useEffect(() => {
    if (!petKey) {
      setScene(null)
      setStatus('vazio')
      return
    }
    let alive = true
    setStatus('montando')
    setError('')
    const timer = setTimeout(() => {
      createThanksScene({ pets: petsRef.current, message, url, format })
        .then((built) => {
          if (!alive) return
          setScene(built)
          setStatus('pronto')
          setPlayKey((key) => key + 1)
        })
        .catch((e: unknown) => {
          if (!alive) return
          setScene(null)
          setStatus('erro')
          setError((e as Error).message || 'Não deu pra montar a animação')
        })
    }, 220)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [petKey, message, format, url])

  // Mixa a trilha nos instantes da cena. Sem arquivos em public/sons/ o vídeo sai mudo.
  useEffect(() => {
    if (!scene) {
      setAudio(null)
      return
    }
    let alive = true
    loadSounds()
      .then((sounds) => (hasSound(sounds) ? renderSceneAudio(sounds, scene.cues, scene.duration) : null))
      .then((buffer) => alive && setAudio(buffer))
      .catch(() => alive && setAudio(null))
    return () => {
      alive = false
    }
  }, [scene])

  useEffect(() => () => playerRef.current?.close(), [])

  // Trocar qualquer coisa invalida o arquivo já gerado.
  const resultRef = useRef<Result | null>(null)
  resultRef.current = result
  useEffect(() => {
    const previous = resultRef.current
    if (!previous) return
    URL.revokeObjectURL(previous.story.preview)
    setResult(null)
  }, [petKey, message, format])

  useEffect(
    () => () => {
      abortRef.current?.abort()
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.story.preview)
    },
    [],
  )

  // Toca a animação em loop na prévia (parada enquanto gera o arquivo, pra não brigar por CPU).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!scene || !canvas || busy) return
    canvas.width = Math.round(scene.width * PREVIEW_SCALE)
    canvas.height = Math.round(scene.height * PREVIEW_SCALE)
    const ctx = canvas.getContext('2d', { alpha: false })!
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const start = performance.now()
    let raf = 0
    let lastT = Infinity
    const sing = () => {
      if (!audio || muted) return
      playerRef.current ??= createCuePlayer()
      playerRef.current.play(audio)
    }
    sing()
    const tick = (now: number) => {
      // Um respiro de meio segundo entre um laço e outro.
      const t = ((now - start) / 1000) % (scene.duration + 0.5)
      // Voltou pro começo: a trilha recomeça junto.
      if (t < lastT) sing()
      lastT = t
      ctx.setTransform(PREVIEW_SCALE, 0, 0, PREVIEW_SCALE, 0, 0)
      scene.drawFrame(ctx, Math.min(t, scene.duration))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      playerRef.current?.stop()
    }
  }, [scene, playKey, busy, audio, muted])

  async function generate() {
    if (!scene || busy) return
    haptic()
    const controller = new AbortController()
    abortRef.current = controller
    setError('')
    setProgress(0.001)
    try {
      const video = await encodeVideo({
        width: scene.width,
        height: scene.height,
        fps: scene.fps,
        duration: scene.duration,
        draw: scene.drawFrame,
        audio,
        onProgress: setProgress,
        signal: controller.signal,
      })
      const file = new File([video.blob], `pets-que-ajudaram.${video.ext}`, { type: video.blob.type })
      setResult({
        story: { file, preview: URL.createObjectURL(video.blob) },
        ext: video.ext,
        mode: video.mode,
        hasAudio: video.hasAudio,
      })
      track('video_gerado', { pets: pets.length, formato: format, som: video.hasAudio ? 'sim' : 'nao' })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Não deu pra gerar o vídeo')
    } finally {
      abortRef.current = null
      setProgress(0)
    }
  }

  const cancel = useCallback(() => abortRef.current?.abort(), [])
  const seconds = scene ? scene.duration.toFixed(1).replace('.', ',') : '0'

  if (!pets.length) {
    return (
      <section className="video-empty" aria-live="polite">
        <Clapperboard size={28} />
        <p>Escolha pelo menos um pet lá em cima pra ver a animação aqui.</p>
      </section>
    )
  }

  return (
    <section className="stack video-studio" style={{ '--gap': '12px' } as CSSProperties} aria-label="Prévia do vídeo">
      <div className="video-section-head">
        <span className="label">4. Prévia</span>
        {status === 'pronto' && (
          <span className="row" style={{ '--gap': '6px' } as CSSProperties}>
            {audio && (
              <button className="pill pill--sm" aria-pressed={muted} onClick={() => setMuted((value) => !value)}>
                {muted ? <VolumeX size={14} strokeWidth={2.5} /> : <Volume2 size={14} strokeWidth={2.5} />}
                {muted ? 'Mudo' : 'Som'}
              </button>
            )}
            <button className="pill pill--sm" onClick={() => setPlayKey((key) => key + 1)}>
              <RotateCcw size={14} strokeWidth={2.5} /> Do começo
            </button>
          </span>
        )}
      </div>

      <div className={`video-stage ${status === 'pronto' ? '' : 'skeleton'}`} data-format={format} aria-busy={status === 'montando'}>
        {status === 'pronto' ? (
          <canvas ref={canvasRef} className="video-canvas" aria-label={`Animação com ${pets.length} pets`} />
        ) : (
          <div className="story-fallback" role="status">
            <PawPrint size={30} />
            <span>{status === 'erro' ? error || 'Não deu pra montar a animação' : 'Montando a animação…'}</span>
          </div>
        )}
      </div>

      {status === 'pronto' && (
        <p className="hint-text video-duration">
          {pets.length} {pets.length === 1 ? 'pet' : 'pets'} · {seconds}s ·{' '}
          {audio ? 'com os sons do abrigo' : 'sem som (dá pra colocar música no Instagram)'}
        </p>
      )}

      {busy ? (
        <>
          <div className="video-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <span style={{ width: `${Math.max(3, progress * 100)}%` }} />
          </div>
          <p className="hint-text" role="status">
            Gerando o vídeo… {Math.round(progress * 100)}%
          </p>
          <button className="pill pill--sm" onClick={cancel}>
            <Square size={13} strokeWidth={3} /> Cancelar
          </button>
        </>
      ) : (
        <button className="btn btn--yellow" onClick={generate} disabled={status !== 'pronto'}>
          <Wand2 size={20} strokeWidth={2.5} /> {result ? 'Gerar de novo' : 'Gerar vídeo'}
        </button>
      )}

      {error && !busy && (
        <p className="hint-text" role="alert">
          {error}
        </p>
      )}

      {result && (
        <>
          <div className="video-result" data-format={format}>
            <video src={result.story.preview} controls loop playsInline preload="metadata" />
          </div>
          <p className="video-ready">
            <Check size={16} strokeWidth={3} /> Vídeo pronto em {result.ext.toUpperCase()}
          </p>
          {audio && !result.hasAudio && (
            <p className="hint-text" role="note">
              Este navegador não conseguiu gravar o som — o vídeo saiu mudo. Pelo Chrome o som entra.
            </p>
          )}
          {result.ext === 'webm' && (
            <p className="hint-text" role="note">
              Este navegador só gera WebM, que o Instagram não aceita. Abra esta tela no Chrome pra sair em MP4.
            </p>
          )}
          <StoryShareActions
            story={result.story}
            caption={`${thanksMessage(message)} 💛 Faça a sua parte também! Ajude o ${SHELTER.name}: ${location.origin}/`}
            label="Compartilhar vídeo"
            mediaNoun="o vídeo"
            downloadLabel="Baixar vídeo"
            event="video_compartilhado"
          />
        </>
      )}
    </section>
  )
}

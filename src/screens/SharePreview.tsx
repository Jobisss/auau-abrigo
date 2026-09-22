import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { Download, ExternalLink, Info, PawPrint } from 'lucide-react'
import { InstagramIcon, ScreenHeader, haptic, useToast } from '../components/ui'
import { SHELTER } from '../data/mock'
import { STORY_TEMPLATES, renderStory, type StoryTemplate } from '../lib/story'
import { track } from '../lib/analytics'
import { ANDROID, IN_APP, openInBrowser } from '../lib/inApp'
import { useApp } from '../state/AppState'

/** Story pronto: a imagem e uma URL local pra pré-visualizar. */
interface Story {
  file: File
  preview: string
}

type Stories = Partial<Record<StoryTemplate, Story | 'erro'>>

export default function SharePreview() {
  const { petId } = useParams()
  const { pets, feedStatus, reloadFeed } = useApp()
  const pet = pets.find((p) => p.id === petId)
  useEffect(reloadFeed, [reloadFeed])
  const [toast, showToast] = useToast()
  const [stories, setStories] = useState<Stories>({})
  const [selected, setSelected] = useState<StoryTemplate>('foto')
  const [busy, setBusy] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)

  // Gera os 3 modelos assim que o pet chega da API — e só de novo se mudar algo que aparece neles
  const petRef = useRef(pet)
  petRef.current = pet
  const storyKey = pet ? [pet.id, pet.name, pet.age, pet.photo, pet.exoticFood, pet.favoritePlay].join('|') : ''
  useEffect(() => {
    const pet = petRef.current
    if (!pet) return
    let alive = true
    const urls: string[] = []
    const slug = pet.id.replace(/-[0-9a-f]+$/, '')
    setStories({})
    for (const { id } of STORY_TEMPLATES) {
      renderStory(pet, id, `${location.origin}/`)
        .then((blob) => {
          if (!alive) return
          const preview = URL.createObjectURL(blob)
          urls.push(preview)
          const file = new File([blob], `${slug}-${id}.jpg`, { type: 'image/jpeg' })
          setStories((s) => ({ ...s, [id]: { file, preview } }))
        })
        .catch(() => alive && setStories((s) => ({ ...s, [id]: 'erro' })))
    }
    return () => {
      alive = false
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [storyKey])

  const current = stories[selected]
  const story = current && current !== 'erro' ? current : null

  const caption = pet
    ? `${pet.name}! Está pedindo para você ajudar o ${SHELTER.name} 💛 Poste o seu pet também: ${location.origin}`
    : ''

  /** Toque no botão do modelo: rola o carrossel até ele (o scroll atualiza a seleção). */
  function choose(id: StoryTemplate) {
    haptic()
    setSelected(id)
    carouselRef.current
      ?.querySelector<HTMLElement>(`[data-template="${id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  /** Arrastar o carrossel: o modelo mais perto do centro vira o escolhido. */
  function onScroll() {
    const box = carouselRef.current
    if (!box) return
    const center = box.scrollLeft + box.clientWidth / 2
    let best: StoryTemplate = selected
    let bestDist = Infinity
    for (const el of box.querySelectorAll<HTMLElement>('[data-template]')) {
      const dist = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center)
      if (dist < bestDist) {
        bestDist = dist
        best = el.dataset.template as StoryTemplate
      }
    }
    if (best !== selected) setSelected(best)
  }

  function download() {
    if (!story) return
    const a = document.createElement('a')
    a.href = story.preview
    a.download = story.file.name
    // Samsung Internet e Firefox ignoram o clique num link fora da página
    document.body.appendChild(a)
    a.click()
    a.remove()
    showToast({ message: 'Imagem salva! Agora é só postar no seu story', tone: 'success' })
  }

  /**
   * Folha de compartilhamento do celular (Instagram, WhatsApp…). Sem suporte a arquivo, baixa a imagem.
   * No Android (Samsung principalmente) mandar texto junto com a imagem faz o share falhar ou o
   * Instagram recusar — lá vai só a imagem e a legenda fica copiada pra colar.
   */
  async function share() {
    if (!story) return
    haptic()
    setBusy(true)
    const data: ShareData = ANDROID ? { files: [story.file] } : { files: [story.file], text: caption }
    try {
      if (navigator.canShare?.(data)) {
        if (ANDROID) navigator.clipboard?.writeText(caption).catch(() => {})
        await navigator.share(data)
        track('story_compartilhado')
        if (ANDROID) showToast({ message: 'Legenda copiada! É só colar no post', tone: 'success' })
        return
      }
      download()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') download()
    } finally {
      setBusy(false)
    }
  }

  const notFound = !pet && feedStatus !== 'loading'

  return (
    <main className="screen cascade">
      <ScreenHeader title="Compartilhar" icon="close" />
      <p className="muted" style={{ fontSize: 15, lineHeight: '22px' }}>
        {notFound
          ? 'Esse pet ainda não está no feed — ele aparece aqui depois de aprovado.'
          : 'Escolha o seu story! Todos têm QR Code pra galera postar o pet dela também.'}
      </p>

      {!notFound && (
        <>
          <div className="row story-picker" role="radiogroup" aria-label="Modelo do story" style={{ '--gap': '8px' } as CSSProperties}>
            {STORY_TEMPLATES.map((t) => (
              <button
                key={t.id}
                className="pill"
                role="radio"
                aria-checked={selected === t.id}
                aria-pressed={selected === t.id}
                onClick={() => choose(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="story-carousel" ref={carouselRef} onScroll={onScroll}>
            {STORY_TEMPLATES.map((t) => {
              const s = stories[t.id]
              return (
                <button
                  key={t.id}
                  type="button"
                  data-template={t.id}
                  className={`story-frame ${s ? '' : 'skeleton'}`}
                  aria-current={selected === t.id || undefined}
                  aria-label={`Modelo ${t.label}`}
                  aria-busy={!s}
                  onClick={() => choose(t.id)}
                >
                  {s && s !== 'erro' ? (
                    <img src={s.preview} alt={`Story modelo ${t.label} com a foto de ${pet?.name}`} />
                  ) : (
                    <span className="story-fallback">
                      <PawPrint size={32} />
                      {s === 'erro' ? 'Não deu pra montar esse' : `Montando ${t.label}…`}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {IN_APP ? (
        <>
          <p className="support-note" role="note">
            <Info size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>
              Você está no <strong>navegador do Instagram</strong>, que não deixa salvar nem compartilhar a imagem.{' '}
              {ANDROID ? (
                'Abra no seu navegador pra postar o story.'
              ) : (
                <>
                  Toque em <strong>•••</strong> no canto da tela e escolha <strong>Abrir no navegador externo</strong>.
                </>
              )}
            </span>
          </p>
          {ANDROID && (
            <button className="btn btn--blue" onClick={openInBrowser}>
              <ExternalLink size={20} strokeWidth={2.5} />
              Abrir no navegador
            </button>
          )}
        </>
      ) : (
        <>
          <button className="btn btn--blue" onClick={share} disabled={!story} aria-busy={busy}>
            <InstagramIcon size={22} />
            Compartilhar story
          </button>
          <button className="btn btn--white" onClick={download} disabled={!story}>
            <Download size={20} strokeWidth={2.5} />
            Baixar imagem
          </button>
        </>
      )}
      {toast}
    </main>
  )
}

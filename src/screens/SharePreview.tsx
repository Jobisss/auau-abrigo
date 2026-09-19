import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, PawPrint, QrCode } from 'lucide-react'
import { InstagramIcon, ScreenHeader, haptic, useToast } from '../components/ui'
import { SHELTER } from '../data/mock'
import { renderStory } from '../lib/story'
import { useApp } from '../state/AppState'

/** Story pronto: a imagem e uma URL local pra pré-visualizar. */
interface Story {
  file: File
  preview: string
}

export default function SharePreview() {
  const { petId } = useParams()
  const { pets, feedStatus, reloadFeed } = useApp()
  const pet = pets.find((p) => p.id === petId)
  useEffect(reloadFeed, [reloadFeed])
  const [toast, showToast] = useToast()
  const [story, setStory] = useState<Story | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  // Gera a imagem assim que o pet chega da API — e só de novo se mudar algo que aparece nela
  const petRef = useRef(pet)
  petRef.current = pet
  const storyKey = pet ? [pet.id, pet.name, pet.age, pet.photo].join('|') : ''
  useEffect(() => {
    const pet = petRef.current
    if (!pet) return
    let alive = true
    let preview = ''
    renderStory(pet, { url: `${location.origin}/` })
      .then((blob) => {
        if (!alive) return
        preview = URL.createObjectURL(blob)
        const slug = pet.id.replace(/-[0-9a-f]+$/, '')
        setStory({ file: new File([blob], `${slug}-story.jpg`, { type: 'image/jpeg' }), preview })
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [storyKey])

  const caption = pet
    ? `Conheca ${pet.name}! Poste o seu pet tambem e ajude o ${SHELTER.name} 🐾 ${location.origin}`
    : ''

  function download() {
    if (!story) return
    const a = document.createElement('a')
    a.href = story.preview
    a.download = story.file.name
    a.click()
    showToast({ message: 'Imagem salva! Agora e so postar no seu story', tone: 'success' })
  }

  /** Folha de compartilhamento do celular (Instagram, WhatsApp…). Sem suporte a arquivo, baixa a imagem. */
  async function share() {
    if (!story) return
    haptic()
    setBusy(true)
    try {
      if (navigator.canShare?.({ files: [story.file] })) {
        await navigator.share({ files: [story.file], text: caption })
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
          ? 'Esse pet ainda nao esta no feed — ele aparece aqui depois de aprovado.'
          : 'Seu story ja esta pronto! Tem QR Code pra galera postar o pet dela tambem.'}
      </p>

      {!notFound && (
        <div className={`story-frame ${story ? '' : 'skeleton'}`} aria-busy={!story && !failed}>
          {story ? (
            <img src={story.preview} alt={`Story de ${pet?.name}: foto, nome e QR Code do site`} />
          ) : failed ? (
            <span className="story-fallback">
              <PawPrint size={32} />
              Nao deu pra montar a imagem
            </span>
          ) : (
            <span className="story-fallback">
              <QrCode size={32} />
              Montando seu story…
            </span>
          )}
        </div>
      )}

      <button className="btn btn--blue" onClick={share} disabled={!story} aria-busy={busy}>
        <InstagramIcon size={22} />
        Compartilhar story
      </button>
      <button className="btn btn--white" onClick={download} disabled={!story}>
        <Download size={20} strokeWidth={2.5} />
        Baixar imagem
      </button>
      {toast}
    </main>
  )
}

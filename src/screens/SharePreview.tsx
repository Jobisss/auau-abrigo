import { useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { PawPrint, QrCode } from 'lucide-react'
import { InstagramIcon, ScreenHeader, useToast } from '../components/ui'
import { SHELTER } from '../data/mock'
import { useApp } from '../state/AppState'

export default function SharePreview() {
  const { petId } = useParams()
  const { pets } = useApp()
  const pet = pets.find((p) => p.id === petId)
  const [toast, showToast] = useToast()
  const [busy, setBusy] = useState(false)

  /**
   * Abre a folha de compartilhamento nativa do celular (onde o usuário escolhe
   * Instagram Stories). Sem suporte a Web Share, copia o link.
   */
  async function share() {
    const url = `${location.origin}/reels${pet ? `?pet=${pet.id}` : ''}`
    const text = pet ? `Conheca ${pet.name} e ajude o ${SHELTER.name}!` : `Ajude o ${SHELTER.name}!`
    setBusy(true)

    try {
      const files: File[] = []
      if (pet?.photo) {
        const blob = await fetch(pet.photo).then((r) => r.blob())
        files.push(new File([blob], `${pet.name}.jpg`, { type: blob.type || 'image/jpeg' }))
      }
      if (files.length && navigator.canShare?.({ files })) {
        await navigator.share({ files, text, url })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: SHELTER.name, text, url })
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    } finally {
      setBusy(false)
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      showToast({ message: 'Link copiado! Cole no seu story', tone: 'success' })
    } catch {
      showToast({ message: 'Nao foi possivel compartilhar', tone: 'error' })
    }
  }

  return (
    <main className="screen cascade">
      <ScreenHeader title="Stories do Instagram" icon="close" />
      <p className="muted" style={{ fontSize: 15 }}>
        Os stickers vao direto pro editor do Instagram Stories
      </p>

      <section className="share-preview">
        <div className="share-canvas">
          <span className="share-caption">Seu story + stickers do app</span>
          <div className="row" style={{ '--gap': '16px', justifyContent: 'center' } as CSSProperties}>
            <span className="chip-pet" style={pet?.photo ? { backgroundImage: `url(${pet.photo})` } : undefined}>
              {!pet?.photo && <PawPrint size={28} strokeWidth={2} />}
            </span>
            <span className="chip-qr">
              <QrCode size={40} strokeWidth={2} />
            </span>
            <span className="chip-link">{SHELTER.shortName}</span>
          </div>
        </div>
        <div className="share-footer">
          <InstagramIcon size={18} />
          Stickers prontos no Instagram
        </div>
      </section>

      <button className="btn btn--blue" onClick={share} aria-busy={busy}>
        <InstagramIcon size={22} />
        Abrir Instagram Stories
      </button>
      {toast}
    </main>
  )
}

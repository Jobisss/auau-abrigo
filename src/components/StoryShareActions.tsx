import { useRef, useState } from 'react'
import { Download, ExternalLink, Info } from 'lucide-react'
import { InstagramIcon, haptic } from './ui'
import { track, type AnalyticsEvent } from '../lib/analytics'
import { ANDROID, IN_APP, openInBrowser } from '../lib/inApp'

export interface ShareableStory {
  file: File
  preview: string
}

/** Compartilhamento comum às imagens de um pet, às montagens de agradecimento e ao vídeo. */
export function StoryShareActions({
  story,
  caption,
  label = 'Compartilhar story',
  mediaNoun = 'a imagem',
  downloadLabel = 'Baixar imagem',
  event = 'story_compartilhado',
}: {
  story: ShareableStory | null
  caption: string
  label?: string
  /** Como o arquivo é chamado nos avisos ("a imagem", "o vídeo"). */
  mediaNoun?: string
  downloadLabel?: string
  event?: AnalyticsEvent
}) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const downloadRef = useRef<HTMLAnchorElement>(null)

  function download() {
    if (!story) return
    // Dentro do dialog: links anexados ao body ficam inertes enquanto a prévia está aberta.
    downloadRef.current?.click()
  }

  async function share() {
    if (!story || busy) return
    haptic()
    setBusy(true)
    // No Android enviar texto junto com a imagem pode fazer o Instagram recusar o arquivo.
    const data: ShareData = ANDROID ? { files: [story.file] } : { files: [story.file], text: caption }
    try {
      if (navigator.canShare?.(data)) {
        if (ANDROID) navigator.clipboard?.writeText(caption).catch(() => {})
        await navigator.share(data)
        track(event)
        if (ANDROID) setNotice('Legenda copiada! É só colar no post')
        return
      }
      download()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') download()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {IN_APP ? (
        <>
          <p className="support-note" role="note">
            <Info size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>
              Você está no <strong>navegador do Instagram</strong>, que não deixa salvar nem compartilhar {mediaNoun}.{' '}
              {ANDROID ? 'Abra no seu navegador pra postar o story.' : (
                <>Toque em <strong>•••</strong> no canto da tela e escolha <strong>Abrir no navegador externo</strong>.</>
              )}
            </span>
          </p>
          {ANDROID && (
            <button className="btn btn--blue" onClick={openInBrowser}>
              <ExternalLink size={20} strokeWidth={2.5} /> Abrir no navegador
            </button>
          )}
        </>
      ) : (
        <>
          <button className="btn btn--blue" onClick={share} disabled={!story || busy} aria-busy={busy}>
            <InstagramIcon size={22} /> {label}
          </button>
          <a ref={downloadRef} className="btn btn--white" href={story?.preview} download={story?.file.name}
            aria-disabled={!story} tabIndex={story ? 0 : -1}
            onClick={(clickEvent) => {
              if (!story) { clickEvent.preventDefault(); return }
              setNotice(`Download iniciado! Agora é só postar ${mediaNoun} no Instagram`)
            }}>
            <Download size={20} strokeWidth={2.5} /> {downloadLabel}
          </a>
        </>
      )}
      {notice && <p className="hint-text" role="status">{notice}</p>}
    </>
  )
}

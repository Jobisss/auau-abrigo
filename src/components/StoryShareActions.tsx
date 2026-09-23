import { useRef, useState } from 'react'
import { Download, ExternalLink, Info } from 'lucide-react'
import { InstagramIcon, haptic } from './ui'
import { track } from '../lib/analytics'
import { ANDROID, IN_APP, openInBrowser } from '../lib/inApp'

export interface ShareableStory {
  file: File
  preview: string
}

/** Compartilhamento comum às imagens de um pet e às montagens de agradecimento. */
export function StoryShareActions({ story, caption, label = 'Compartilhar story' }: {
  story: ShareableStory | null
  caption: string
  label?: string
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
        track('story_compartilhado')
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
              Você está no <strong>navegador do Instagram</strong>, que não deixa salvar nem compartilhar a imagem.{' '}
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
            onClick={(event) => {
              if (!story) { event.preventDefault(); return }
              setNotice('Download iniciado! Agora é só postar a imagem no seu story')
            }}>
            <Download size={20} strokeWidth={2.5} /> Baixar imagem
          </a>
        </>
      )}
      {notice && <p className="hint-text" role="status">{notice}</p>}
    </>
  )
}

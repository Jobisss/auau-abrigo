import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Clapperboard, Heart, PawPrint, X } from 'lucide-react'
import { InstagramIcon } from '../components/ui'
import { StoryShareActions, type ShareableStory } from '../components/StoryShareActions'
import { SHELTER, type Pet } from '../data/mock'
import { ApiError, api } from '../lib/api'
import { PETS_PER_THANKS_STORY } from '../lib/thanks'
import { renderThanksStory } from '../lib/story'

export default function GroupThanks({ ids, message }: { ids: string; message: string }) {
  const petIds = useMemo(() => [...new Set(ids.split(',').map((id) => id.trim()).filter(Boolean))], [ids])
  const [pets, setPets] = useState<Pet[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    let alive = true
    setStatus('loading')
    // Busca os IDs escolhidos, inclusive os mais antigos que não estão nos 200 do feed.
    Promise.all(petIds.map((id) => api.pets.get(id).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }))).then((results) => {
      if (!alive) return
      setPets(results.filter((pet): pet is Pet => pet !== null))
      setStatus('ready')
    }).catch(() => alive && setStatus('error'))
    return () => { alive = false }
  }, [petIds, retry])

  return (
    <main className="screen thanks-custom">
      <header className="thanks-custom-header">
        <Link to="/abrigo" className="thanks-shelter"><PawPrint size={18} /> {SHELTER.shortName}</Link>
        <span className="thanks-custom-kicker"><Heart size={13} fill="currentColor" /> Uma corrente de carinho</span>
        <h1 className="title-hand thanks-custom-title">{message}</h1>
        <p className="thanks-custom-lead">Patinhas que fazem a diferença. <Heart size={15} aria-hidden="true" /></p>
      </header>

      {status === 'loading' && (
        <div className="thanks-photo-grid" role="status" aria-label="Carregando as fotos">
          {petIds.slice(0, 4).map((id) => <div key={id} className="thanks-photo-skeleton skeleton" />)}
        </div>
      )}
      {status === 'error' && (
        <div className="thanks-custom-empty" role="alert">
          <PawPrint size={28} />
          <p>Não foi possível carregar as fotos. Confira sua conexão e tente de novo.</p>
          <button className="pill" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button>
        </div>
      )}
      {status === 'ready' && (
        <>
          <section className="thanks-photo-grid" data-count={pets.length} aria-label="Pets que já ajudaram">
            {pets.map((pet, index) => (
              <figure key={pet.id} className="thanks-photo-card">
                <div className="thanks-photo-image" style={{ backgroundImage: `url(${pet.photo})` }}>
                  <img src={pet.photo} alt={`Foto de ${pet.name}`} loading={index < 4 ? 'eager' : 'lazy'} />
                </div>
                <figcaption><span>{pet.name}</span><Heart size={17} aria-hidden="true" /></figcaption>
              </figure>
            ))}
          </section>
          {pets.length === 0 ? (
            <div className="thanks-custom-empty"><PawPrint size={28} /><p>Essas fotos não estão mais disponíveis.</p></div>
          ) : (
            <section className="thanks-share-invite" aria-label="Compartilhar agradecimento">
              <p>Carinho bom é carinho compartilhado.</p>
              <button className="btn btn--blue" onClick={() => setSharing(true)}>
                <InstagramIcon size={22} /> Compartilhar no Instagram
              </button>
              <Link className="btn btn--white" to={`/video?pets=${encodeURIComponent(pets.map((pet) => pet.id).join(','))}&mensagem=${encodeURIComponent(message)}`}>
                <Clapperboard size={21} strokeWidth={2.5} /> Fazer vídeo dessa turma
              </Link>
              <span>Uma imagem para os stories ou um vídeo animado para o post.</span>
            </section>
          )}
          {pets.length > 0 && pets.length < petIds.length && <p className="muted">Alguns pets não estão mais disponíveis e ficaram fora desta seleção.</p>}
        </>
      )}

      <section className="thanks-custom-cta">
        <span className="thanks-cta-paw" aria-hidden="true"><PawPrint size={28} /></span>
        <div>
          <h2 className="title-hand">Faça a sua parte também!</h2>
          <p>Seu pet também pode ajudar o abrigo.</p>
        </div>
        <Link className="btn btn--yellow" to="/adicionar">Quero ajudar <ArrowRight size={19} /></Link>
      </section>
      <Link className="link thanks-feed-link" to="/reels">Conhecer todos os pets <ArrowRight size={15} /></Link>

      {sharing && <ThanksStoryDialog pets={pets} message={message} onClose={() => setSharing(false)} />}
    </main>
  )
}

function ThanksStoryDialog({ pets, message, onClose }: { pets: Pet[]; message: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [page, setPage] = useState(0)
  const pages = useMemo(() => {
    const groups: Pet[][] = []
    for (let index = 0; index < pets.length; index += PETS_PER_THANKS_STORY) groups.push(pets.slice(index, index + PETS_PER_THANKS_STORY))
    return groups
  }, [pets])

  useLayoutEffect(() => {
    const dialog = dialogRef.current!
    const returnFocus = document.activeElement
    dialog.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus()
    }
  }, [])

  return (
    <dialog ref={dialogRef} className="thanks-story-dialog" aria-labelledby="thanks-story-title" onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="thanks-story-content">
        <header className="thanks-story-header">
          <div><span className="label">PRONTO PARA OS STORIES</span><h2 id="thanks-story-title" className="title-hand">Espalhe esse carinho</h2></div>
          <button className="icon-btn" aria-label="Fechar prévia" onClick={onClose} autoFocus><X size={20} /></button>
        </header>
        {pages.length > 1 && (
          <div className="thanks-story-pagination">
            <button className="icon-btn" disabled={page === 0} aria-label="Story anterior" onClick={() => setPage(page - 1)}><ChevronLeft size={20} /></button>
            <span aria-live="polite">Story {page + 1} de {pages.length}</span>
            <button className="icon-btn" disabled={page === pages.length - 1} aria-label="Próximo story" onClick={() => setPage(page + 1)}><ChevronRight size={20} /></button>
          </div>
        )}
        <ThanksStoryPage key={`${page}:${message}`} pets={pages[page]} message={message} page={page} total={pages.length} />
        <p className="thanks-story-note">{pages.length > 1 ? 'Até 4 pets por imagem, para cada um ganhar destaque. Compartilhe cada story.' : 'Escolha o Instagram ao compartilhar ou baixe a imagem para postar.'}</p>
      </div>
    </dialog>
  )
}

function ThanksStoryPage({ pets, message, page, total }: { pets: Pet[]; message: string; page: number; total: number }) {
  const [story, setStory] = useState<ShareableStory | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let alive = true
    let preview: string | undefined
    setError(false)
    setStory(null)
    renderThanksStory(pets, message, `${location.origin}/`, page + 1, total).then((blob) => {
      if (!alive) return
      preview = URL.createObjectURL(blob)
      setStory({ preview, file: new File([blob], `pets-que-ajudaram-${page + 1}.jpg`, { type: 'image/jpeg' }) })
    }).catch(() => alive && setError(true))
    return () => {
      alive = false
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [pets, message, page, total, retry])

  return (
    <>
      <div className={`thanks-story-preview ${!story && !error ? 'skeleton' : ''}`} aria-busy={!story && !error}>
        {story ? <img src={story.preview} alt={`Story com ${pets.map((pet) => pet.name).join(', ')}`} /> : (
          <div className="story-fallback" role="status">
            <PawPrint size={32} />
            <span>{error ? 'Não foi possível montar o story. Confira se as fotos carregaram.' : 'Preparando a foto da turma…'}</span>
            {error && <button className="pill" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button>}
          </div>
        )}
      </div>
      <StoryShareActions story={story} caption={`${message} 💛 Faça a sua parte também! Ajude o ${SHELTER.name}: ${location.origin}/`} label="Compartilhar no Instagram" />
    </>
  )
}

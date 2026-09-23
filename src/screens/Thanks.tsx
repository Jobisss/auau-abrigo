import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Heart, LifeBuoy, PawPrint, Play } from 'lucide-react'
import { Confetti } from '../components/ui'
import { SHELTER } from '../data/mock'
import { useApp } from '../state/AppState'

export default function Thanks() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const customIds = (searchParams.get('pets') ?? '').split(',').filter(Boolean)
  const customMessage = searchParams.get('mensagem')?.trim() || 'Esses doguinhos já ajudaram :)'
  const isCustom = customIds.length > 0
  const { draftPet, markSent, pets, feedStatus, reloadFeed } = useApp()
  const name = draftPet?.name ?? 'seu pet'

  // Daqui em diante, quem reabrir o app cai nesta tela (e não mais no PIX)
  useEffect(() => {
    if (isCustom) {
      reloadFeed()
      return
    }
    markSent()
  }, [isCustom, markSent, reloadFeed])

  if (isCustom) {
    const selectedPets = customIds.map((id) => pets.find((pet) => pet.id === id)).filter((pet): pet is (typeof pets)[number] => Boolean(pet))
    return (
      <main className="screen thanks-custom cascade">
        <Confetti />
        <span className="thanks-custom-kicker"><Heart size={16} fill="currentColor" /> Obrigado por ajudar o abrigo</span>
        <h1 className="title-hand thanks-custom-title">{customMessage}</h1>
        <p className="muted thanks-custom-lead">Eles já fizeram a parte deles. Agora você também pode transformar uma doação em cuidado.</p>

        <section className="thanks-photo-grid" aria-label="Pets que já ajudaram">
          {feedStatus === 'loading' && <p className="muted thanks-custom-loading">Carregando as fotos…</p>}
          {feedStatus !== 'loading' && selectedPets.map((pet) => (
            <figure key={pet.id} className="thanks-photo-card">
              {pet.photo ? <img src={pet.photo} alt={pet.name} /> : <PawPrint size={32} />}
              <figcaption>{pet.name}</figcaption>
            </figure>
          ))}
          {feedStatus !== 'loading' && selectedPets.length === 0 && (
            <div className="thanks-custom-empty">
              <PawPrint size={28} />
              <span>Essas fotos não estão disponíveis no momento.</span>
            </div>
          )}
        </section>

        <div className="thanks-custom-cta">
          <h2 className="h2">Faça a sua parte também!</h2>
          <p className="muted">Cadastre seu pet e ajude o abrigo a continuar cuidando de mais patinhas.</p>
          <button className="btn btn--blue" onClick={() => navigate('/adicionar')}>
            <ArrowRight size={20} strokeWidth={2.5} />
            Quero ajudar
          </button>
        </div>
        <button className="btn btn--white" onClick={() => navigate('/reels')}>
          <Play size={20} strokeWidth={2.5} />
          Ver todos os pets
        </button>
      </main>
    )
  }

  return (
    <main className="screen cascade" style={{ gap: 20, paddingTop: 40 }}>
      <Confetti />
      <h1 className="title-hand">
        <span className="wiggle">O(a) {name} aparece já já!</span>
      </h1>
      <p className="muted" style={{ fontSize: 16, lineHeight: '24px' }}>
        Obrigado por apoiar o abrigo e por mostrar seu pet! &lt;3
      </p>

      <section className="card card--lg" style={{ gap: 12 }}>
        <h2 className="h2">Como funciona a espera?</h2>
        <p className="card-body" style={{ fontSize: 15 }}>
          Recebemos seu comprovante e vamos conferir a doação. Assim que aprovarmos, seu pet entra no feed Reels para
          todo mundo ver!
        </p>
      </section>

      <section className="card card--md card--yellow">
        <h2 className="card-title" style={{ fontSize: 14 }}>
          <LifeBuoy size={18} strokeWidth={2.2} />
          Precisa de ajuda?
        </h2>
        <p className="card-body" style={{ fontSize: 13, lineHeight: '18px' }}>
          Se o seu pet não apareceu em até 24h, fale conosco no WhatsApp: {SHELTER.whatsapp}
        </p>
      </section>

      <button className="btn btn--blue" onClick={() => navigate('/reels')}>
        <Play size={20} strokeWidth={2.5} />
        Ver o feed Reels
      </button>
      <p className="footer-note">Você está ajudando o abrigo a cuidar de mais patinhas!</p>
    </main>
  )
}

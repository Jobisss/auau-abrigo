import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LifeBuoy, Play } from 'lucide-react'
import { Confetti } from '../components/ui'
import { SHELTER } from '../data/mock'
import { useApp } from '../state/AppState'
import { thanksMessage } from '../lib/thanks'
import GroupThanks from './GroupThanks'

export default function Thanks() {
  const [searchParams] = useSearchParams()
  const ids = searchParams.get('pets') ?? ''
  if (ids.split(',').some((id) => id.trim())) {
    return <GroupThanks key={ids} ids={ids} message={thanksMessage(searchParams.get('mensagem'))} />
  }
  return <PendingThanks />
}

function PendingThanks() {
  const navigate = useNavigate()
  const { draftPet, markSent } = useApp()
  const name = draftPet?.name ?? 'seu pet'

  // Apenas a tela de espera avança o cadastro para "comprovante enviado".
  useEffect(markSent, [markSent])

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

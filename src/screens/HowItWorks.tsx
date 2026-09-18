import type { CSSProperties, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, Camera, HeartHandshake, LogIn, MessageCircle, PawPrint, Play, Timer, type LucideIcon } from 'lucide-react'
import { SupportMenu } from '../components/ui'
import { SHELTER } from '../data/mock'

interface Step {
  icon: LucideIcon
  title: string
  text: ReactNode
}

const STEPS: Step[] = [
  { icon: LogIn, title: 'Voce entra', text: 'Entre no app e comece por aqui.' },
  { icon: Camera, title: 'Adiciona o pet', text: 'Preencha foto, nome, idade e curiosidades do seu bichinho.' },
  {
    icon: HeartHandshake,
    title: 'PIX direto pro abrigo',
    text: (
      <>
        Escolha R$ 5, R$ 10, R$ 25 ou outro. Todo valor vai 100% direto pro abrigo!
        <br />
        <Link to="/abrigo" className="link step-link">
          Conheca o abrigo &gt;
        </Link>
      </>
    ),
  },
  {
    icon: MessageCircle,
    title: 'Envie o comprovante',
    text: `Mande o comprovante do PIX no WhatsApp: wa.me/${SHELTER.whatsapp}`,
  },
  {
    icon: Timer,
    title: 'Aguarda a aprovacao',
    text: 'Seu pet ainda nao aparece no Reels na hora! Conferimos a doacao e liberamos em breve.',
  },
]

/** Posição na cascata para os blocos que vêm depois da linha do tempo. */
const after = (i: number) => ({ '--i': STEPS.length + 2 + i }) as CSSProperties

export default function HowItWorks() {
  const navigate = useNavigate()

  return (
    <main className="screen cascade">
      <header className="screen-header">
        <h1 className="title-hand grow">Como funciona?</h1>
        <SupportMenu />
      </header>

      <p className="muted">Siga o passo a passo — apos a aprovacao, seu pet entra no Reels!</p>

      <ol className="timeline cascade" style={{ '--base': 100 } as CSSProperties}>
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="timeline-item">
            <div className="timeline-track">
              <span className={`step-num ${i === 0 ? 'step-num--blue' : ''}`}>{i + 1}</span>
              {i < STEPS.length - 1 && <span className="timeline-line" />}
            </div>
            <div className="timeline-body">
              <h2 className="timeline-title">
                <Icon size={16} strokeWidth={2.2} />
                {title}
              </h2>
              <p className="muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="card card--md card--orange" style={after(0)}>
        <h2 className="card-title">
          <BadgeCheck size={18} strokeWidth={2.2} />
          Sobre a aprovacao
        </h2>
        <p className="card-body">
          Apos enviar o comprovante, nossa equipe confere a doacao. Se nao aparecer em ate 24h, fale conosco:{' '}
          {SHELTER.whatsapp}
        </p>
      </section>

      <div className="stack" style={{ '--gap': '14px', ...after(1) } as CSSProperties}>
        <button className="btn btn--blue" onClick={() => navigate('/adicionar')}>
          <PawPrint size={20} strokeWidth={2.5} />
          Adicionar meu pet
        </button>
        <button className="btn btn--yellow" onClick={() => navigate('/reels')}>
          <Play size={20} strokeWidth={2.5} />
          Ver o feed Reels
        </button>
      </div>

      <Link to="/admin/login" className="admin-link" style={after(2)}>
        Sou do abrigo
      </Link>
    </main>
  )
}

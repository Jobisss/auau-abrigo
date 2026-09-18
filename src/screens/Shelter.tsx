import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Copy, HandHeart, MapPin } from 'lucide-react'
import hero from '../assets/abrigo-hero.jpg'
import { CountUp, InstagramIcon, ScreenHeader, haptic, useToast } from '../components/ui'
import { SHELTER } from '../data/mock'
import { PIX_ENABLED, PIX_KEY } from '../lib/pix'

/** "320+" anima de 0 a 320; valores como "24/7" ficam estáticos. */
function StatValue({ value }: { value: string }) {
  const m = value.match(/^(\d+)(\D*)$/)
  if (!m) return <>{value}</>
  return (
    <>
      <CountUp value={Number(m[1])} />
      {m[2]}
    </>
  )
}

export default function Shelter() {
  const navigate = useNavigate()
  const [toast, showToast] = useToast()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(t)
  }, [copied])

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(PIX_KEY)
    } catch {
      /* ignora */
    }
    haptic()
    setCopied(true)
    showToast({ message: 'Chave PIX copiada!', tone: 'success' })
  }

  return (
    <main className="screen cascade">
      <ScreenHeader title="Conheca o abrigo" back="/" />

      <div className="hero-img" role="img" aria-label="Voluntarios cuidando de um bichinho no abrigo">
        <div style={{ backgroundImage: `url(${hero})` }} />
      </div>

      <div className="stack" style={{ '--gap': '8px' } as CSSProperties}>
        <h2 className="h2">{SHELTER.name}</h2>
        <p className="muted row" style={{ fontSize: 15, lineHeight: '22px', '--gap': '6px' } as CSSProperties}>
          <MapPin size={16} strokeWidth={2.2} color="var(--blue)" />
          {SHELTER.tagline}
        </p>
      </div>

      <section className="card card--lg" style={{ gap: 12 }}>
        <h2 className="h2">Nossa missao</h2>
        <p className="card-body" style={{ fontSize: 15, lineHeight: '22px' }}>
          {SHELTER.mission}
        </p>
      </section>

      <div className="stats-row cascade" style={{ '--base': 200 } as CSSProperties}>
        {SHELTER.stats.map((s) => (
          <div key={s.label} className="stat">
            <strong>
              <StatValue value={s.value} />
            </strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {PIX_ENABLED && (
      <button className="card card--md card--yellow card--interactive pix-info" onClick={copyKey} aria-label="Copiar chave PIX">
        <span className="h3" style={{ fontSize: 14 }}>
          Doacao 100% direto pro abrigo
        </span>
        <span className="big-link row" style={{ '--gap': '8px' } as CSSProperties}>
          {SHELTER.pixKey}
          {copied ? <Check key="ok" size={20} strokeWidth={3} className="pop" /> : <Copy key="copy" size={18} strokeWidth={2.5} />}
        </span>
        <span className="card-body" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          {copied ? 'Copiada! Agora e so colar no app do banco.' : 'Chave PIX — toque para copiar e envie apos publicar seu pet.'}
        </span>
      </button>
      )}

      <section className="card card--md card--teal">
        <h2 className="card-title">
          <HandHeart size={18} strokeWidth={2.2} />
          Outras formas de ajudar
        </h2>
        <p className="card-body" style={{ color: 'var(--ink)' }}>
          O abrigo tambem recebe racao e produtos de limpeza, com pontos de coleta em mercados e pet shops de Ivaipora.
        </p>
      </section>

      <a className="btn btn--white" href={SHELTER.instagramUrl} target="_blank" rel="noreferrer">
        <InstagramIcon size={20} />
        Seguir no Instagram
      </a>

      <button className="btn btn--blue" onClick={() => navigate('/')}>
        <ArrowLeft size={20} strokeWidth={2.5} />
        Voltar ao passo a passo
      </button>
      {toast}
    </main>
  )
}

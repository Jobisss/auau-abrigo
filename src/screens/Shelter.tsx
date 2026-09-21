import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, HandHeart } from 'lucide-react'
import hero from '../assets/abrigo-banner.jpg'
import { CountUp, InstagramIcon, ScreenHeader } from '../components/ui'
import { SHELTER } from '../data/mock'

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

  return (
    <main className="screen cascade">
      <ScreenHeader title="Conheça o abrigo" back="/" />

      <div className="hero-img" role="img" aria-label="Cachorro do abrigo olhando pra câmera">
        <div style={{ backgroundImage: `url(${hero})`, backgroundPosition: '38% center' }} />
      </div>

      <div className="stack" style={{ '--gap': '8px' } as CSSProperties}>
        <h2 className="h2">{SHELTER.name}</h2>
        <ul className="shelter-bio">
          {SHELTER.bio.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

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

      <section className="card card--md card--teal">
        <h2 className="card-title">
          <HandHeart size={18} strokeWidth={2.2} />
          Outras formas de ajudar
        </h2>
        <p className="card-body" style={{ color: 'var(--ink)' }}>
          O abrigo também recebe ração e produtos de limpeza, com pontos de coleta em mercados e pet shops de Ivaiporã.
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
    </main>
  )
}

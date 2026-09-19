import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Apple, ArrowLeft, ChevronUp, Footprints, Heart, HeartHandshake, PawPrint, Share2 } from 'lucide-react'
import { SupportMenu, haptic, useImageLoaded } from '../components/ui'
import { formatLikes, type Pet } from '../data/mock'
import { formatAge } from '../lib/age'
import { useApp } from '../state/AppState'

/** Quanto tempo segurando a foto até esconder o texto. */
const HOLD_MS = 220

/** Direções dos coraçõezinhos que saltam do botão de curtir. */
const SPARKS = [
  { x: -22, y: -30, d: 0 },
  { x: 0, y: -40, d: 40 },
  { x: 22, y: -30, d: 20 },
  { x: -28, y: -6, d: 60 },
  { x: 28, y: -6, d: 80 },
  { x: -10, y: -52, d: 100 },
]

export default function Reels() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { pets, feedStatus, reloadFeed } = useApp()
  const feed = pets.filter((p) => p.status === 'ativo').sort((a, b) => b.createdAt - a.createdAt)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(reloadFeed, [reloadFeed])

  // Deep link: /reels?pet=<id> abre direto naquele pet (espera o feed chegar da API)
  useEffect(() => {
    const id = params.get('pet')
    if (!id || feed.length === 0) return
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-pet="${CSS.escape(id)}"]`)
    el?.scrollIntoView({ block: 'start' })
  }, [params, feed.length])

  return (
    <div className="reels">
      <div className="reels-top">
        <button className="reels-back" aria-label="Voltar" onClick={() => navigate('/')}>
          <ArrowLeft size={22} strokeWidth={2.5} />
        </button>
        <SupportMenu dark />
      </div>

      <div className="reels-scroll" ref={scrollRef} onScroll={() => !scrolled && setScrolled(true)}>
        {feed.length === 0 && feedStatus === 'loading' ? (
          <div className="reel reel--empty" aria-busy="true">
            <PawPrint size={48} />
            <p>Carregando os pets…</p>
          </div>
        ) : feed.length === 0 && feedStatus === 'error' ? (
          <div className="reel reel--empty">
            <PawPrint size={48} />
            <p>Nao deu pra carregar o feed.</p>
            <button className="btn btn--yellow" style={{ width: 'auto' }} onClick={reloadFeed}>
              Tentar de novo
            </button>
          </div>
        ) : feed.length === 0 ? (
          <div className="reel reel--empty">
            <PawPrint size={48} />
            <p>Nenhum pet no feed ainda.</p>
            <button className="btn btn--yellow" style={{ width: 'auto' }} onClick={() => navigate('/adicionar')}>
              Adicionar meu pet
            </button>
          </div>
        ) : (
          feed.map((pet, i) => <Reel key={pet.id} pet={pet} first={i === 0} />)
        )}
      </div>

      {feed.length > 1 && !scrolled && (
        <div className="reels-hint" aria-hidden="true">
          <ChevronUp size={20} strokeWidth={3} />
          Deslize para ver mais
        </div>
      )}
    </div>
  )
}

function Reel({ pet, first }: { pet: Pet; first: boolean }) {
  const navigate = useNavigate()
  const { liked, toggleLike } = useApp()
  const isLiked = liked.includes(pet.id)
  const loaded = useImageLoaded(pet.photo)
  const ref = useRef<HTMLElement>(null)
  // o primeiro já nasce ativo para não depender do observer na abertura
  const [active, setActive] = useState(first)
  const [burst, setBurst] = useState(0)
  const [sparks, setSparks] = useState(0)
  const lastTap = useRef(0)
  const [holding, setHolding] = useState(false)
  const hold = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null)

  useEffect(() => () => clearTimeout(hold.current?.timer), [])

  // Anima o conteúdo quando o reel entra na tela
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  function like() {
    if (!isLiked) {
      setSparks((s) => s + 1)
      haptic()
    }
    toggleLike(pet.id)
  }

  /**
   * Segurar o dedo na foto esconde nome, detalhes e botões (como no Instagram) — soltar mostra de novo.
   * Mexer o dedo antes do tempo é rolagem, não "segurar".
   */
  function onPointerDown(e: PointerEvent) {
    if ((e.target as Element).closest('.reel-actions')) return
    clearTimeout(hold.current?.timer)
    hold.current = {
      x: e.clientX,
      y: e.clientY,
      fired: false,
      timer: window.setTimeout(() => {
        if (!hold.current) return
        hold.current.fired = true
        setHolding(true)
      }, HOLD_MS),
    }
  }

  function onPointerMove(e: PointerEvent) {
    const h = hold.current
    if (!h || h.fired) return
    if (Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) {
      clearTimeout(h.timer)
      hold.current = null
    }
  }

  function endHold() {
    if (!hold.current) return
    clearTimeout(hold.current.timer)
    if (!hold.current.fired) hold.current = null
    setHolding(false)
  }

  function onTap() {
    // O "click" que vem ao soltar depois de segurar não conta como toque (nem pro toque duplo)
    if (hold.current?.fired) {
      hold.current = null
      lastTap.current = 0
      return
    }
    const now = Date.now()
    if (now - lastTap.current < 300) {
      if (!isLiked) like()
      setBurst((b) => b + 1)
    }
    lastTap.current = now
  }

  return (
    <article
      ref={ref}
      className="reel"
      data-pet={pet.id}
      data-active={active || undefined}
      data-holding={holding || undefined}
      onClick={onTap}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endHold}
      onPointerCancel={endHold}
      onPointerLeave={endHold}
      // Toque longo no celular abriria o menu de "salvar imagem" em cima do gesto
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={`reel-bg ${loaded ? 'is-loaded' : ''}`} style={{ backgroundImage: pet.photo ? `url(${pet.photo})` : undefined }} />
      <div className="reel-gradient" />

      {burst > 0 && <Heart key={burst} className="reel-burst" size={96} fill="#fff" strokeWidth={0} />}

      <div className="reel-info">
        <h2 className="reel-name">
          {pet.name}, {formatAge(pet.age)}
        </h2>
        <dl className="reel-details">
          <Detail icon={<Apple size={18} />} label="Comida exótica favorita:" value={pet.exoticFood} />
          <Detail icon={<HeartHandshake size={18} />} label="Como foi adotado:" value={pet.adoptedHow} />
          <Detail icon={<Footprints size={18} />} label="Brincadeira favorita:" value={pet.favoritePlay} />
        </dl>
      </div>

      <div className="reel-actions" onClick={(e) => e.stopPropagation()}>
        <button aria-label="Compartilhar" onClick={() => navigate(`/compartilhar/${pet.id}`)}>
          <Share2 size={28} strokeWidth={2} />
        </button>
        <button aria-label={isLiked ? 'Descurtir' : 'Curtir'} aria-pressed={isLiked} onClick={like}>
          <span className="like-wrap">
            <Heart
              key={String(isLiked)}
              size={28}
              strokeWidth={2}
              className={isLiked ? 'is-liked' : ''}
              fill={isLiked ? 'var(--orange)' : 'none'}
              color={isLiked ? 'var(--orange)' : '#fff'}
            />
            {sparks > 0 && (
              <span key={sparks} className="like-sparks">
                {SPARKS.map((s, i) => (
                  <Heart
                    key={i}
                    size={10}
                    fill="currentColor"
                    strokeWidth={0}
                    style={{ '--x': `${s.x}px`, '--y': `${s.y}px`, '--d': `${s.d}ms` } as CSSProperties}
                  />
                ))}
              </span>
            )}
          </span>
          <span>{formatLikes(pet.likes)}</span>
        </button>
      </div>
    </article>
  )
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="reel-detail">
      {icon}
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  )
}

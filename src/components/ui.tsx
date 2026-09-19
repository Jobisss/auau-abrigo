import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CircleAlert, CircleCheck, Ellipsis, Heart, Info, MessageCircle, PawPrint, Trash2, X } from 'lucide-react'
import { waLink } from '../data/mock'

/** Vibração curtinha em celulares que suportam (Android). */
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* ignora */
  }
}

export function ScreenHeader({
  title,
  back,
  icon = 'back',
  right,
}: {
  title: string
  /** rota de volta; sem valor usa history.back() */
  back?: string
  icon?: 'back' | 'close'
  right?: ReactNode
}) {
  const navigate = useNavigate()
  const Icon = icon === 'close' ? X : ArrowLeft
  return (
    <header className="screen-header">
      <button
        className="icon-btn"
        data-icon={icon}
        aria-label={icon === 'close' ? 'Fechar' : 'Voltar'}
        onClick={() => (back ? navigate(back) : navigate(-1))}
      >
        <Icon size={22} strokeWidth={2.5} />
      </button>
      <h1 className="title-hand grow">{title}</h1>
      {right}
    </header>
  )
}

/** Botão "..." que abre o atalho de Suporte (WhatsApp). */
export function SupportMenu({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu-anchor" ref={ref}>
      <button
        className={`menu-trigger ${dark ? 'menu-trigger--dark' : ''}`}
        aria-label="Mais opções"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Ellipsis size={18} strokeWidth={2.5} />
      </button>
      {open && (
        <a
          className={`menu-pop ${dark ? 'menu-pop--dark' : ''}`}
          href={waLink('Olá! Preciso de ajuda com o app do abrigo.')}
          target="_blank"
          rel="noreferrer"
          onClick={() => setOpen(false)}
        >
          <MessageCircle size={14} strokeWidth={2.5} />
          Suporte
        </a>
      )}
    </div>
  )
}

/**
 * Aviso junto do número do WhatsApp: o app é independente do abrigo,
 * então dúvidas vão pro suporte — não pro Instagram nem pra equipe do abrigo.
 */
export function SupportNote() {
  return (
    <p className="support-note" role="note">
      <Info size={16} strokeWidth={2.5} aria-hidden="true" />
      <span>
        <strong>Importante:</strong> este app e um projeto independente, sem ligacao direta com o abrigo. Duvidas? Fale
        com o <strong>suporte neste numero</strong> — nao com o Instagram nem com os funcionarios do abrigo.
      </span>
    </p>
  )
}

export interface ToastOptions {
  message: string
  tone?: 'success' | 'error' | 'info'
  action?: { label: string; onClick: () => void }
}

type ToastState = ToastOptions & { id: number; leaving?: boolean }

/** Toast com ícone, ação opcional ("Desfazer") e animação de entrada/saída. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!toast) return
    const delay = toast.leaving ? 200 : toast.action ? 4500 : 2400
    const t = setTimeout(() => setToast(toast.leaving ? null : { ...toast, leaving: true }), delay)
    return () => clearTimeout(t)
  }, [toast])

  const show = useCallback((input: string | ToastOptions) => {
    setToast({ ...(typeof input === 'string' ? { message: input } : input), id: Date.now() })
  }, [])

  const Icon = toast?.tone === 'error' ? CircleAlert : toast?.tone === 'success' ? CircleCheck : null

  const node = toast
    ? createPortal(
        <div
          key={toast.id}
          className={['toast', toast.tone === 'error' && 'toast--error', toast.action && 'has-action', toast.leaving && 'is-leaving']
            .filter(Boolean)
            .join(' ')}
          role="status"
          aria-live="polite"
        >
          {Icon && <Icon size={18} strokeWidth={2.5} />}
          <span>{toast.message}</span>
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                toast.action!.onClick()
                setToast(null)
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>,
        document.body,
      )
    : null

  return [node, show] as const
}

/** Modal de confirmação (vira bottom sheet no celular). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="dialog-icon">
          <Trash2 size={24} strokeWidth={2.5} />
        </span>
        <h2 id="dialog-title" className="h2">
          {title}
        </h2>
        <p id="dialog-desc" className="card-body">
          {message}
        </p>
        <div className="dialog-actions">
          <button className="btn btn--white" autoFocus onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn--orange" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const CONFETTI_COLORS = ['var(--blue)', 'var(--yellow)', 'var(--orange)', 'var(--teal)', 'var(--sky)']

/** Chuva de patinhas, corações e papeizinhos — roda uma vez e some. */
export function Confetti({ count = 28 }: { count?: number }) {
  const [done, setDone] = useState(false)
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        duration: 2.2 + Math.random() * 1.6,
        dx: (Math.random() - 0.5) * 140,
        rot: (Math.random() - 0.5) * 720,
        size: 14 + Math.random() * 12,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        kind: i % 3,
      })),
    [count],
  )

  useEffect(() => {
    const t = setTimeout(() => setDone(true), 4800)
    return () => clearTimeout(t)
  }, [])

  if (done || matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  return createPortal(
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              color: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--dx': `${p.dx}px`,
              '--rot': `${p.rot}deg`,
            } as CSSProperties
          }
        >
          {p.kind === 0 ? (
            <PawPrint size={p.size} fill="currentColor" strokeWidth={0} />
          ) : p.kind === 1 ? (
            <Heart size={p.size} fill="currentColor" strokeWidth={0} />
          ) : (
            <i style={{ width: p.size * 0.6, height: p.size * 0.35 }} />
          )}
        </span>
      ))}
    </div>,
    document.body,
  )
}

/** Anima um número de `from` até `value` (e entre mudanças de valor). */
export function useCountUp(value: number, { duration = 800, from }: { duration?: number; from?: number } = {}) {
  const [display, setDisplay] = useState(from ?? value)
  const current = useRef(from ?? value)

  useEffect(() => {
    const start = current.current
    if (start === value) return
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / duration))
      const v = start + (value - start) * (1 - Math.pow(1 - t, 3))
      current.current = v
      setDisplay(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return display
}

export function CountUp({ value, format = (n) => String(Math.round(n)), from = 0 }: { value: number; format?: (n: number) => string; from?: number }) {
  return <>{format(useCountUp(value, { from }))}</>
}

/** true quando a imagem terminou de carregar (para fazer fade-in). */
export function useImageLoaded(src?: string) {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setLoaded(false)
    if (!src) return
    const img = new Image()
    img.onload = img.onerror = () => setLoaded(true)
    img.src = src
    if (img.complete) setLoaded(true)
  }, [src])
  return loaded
}

export function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

/** Fundo de patinhas da tela "Adicione o seu pet". */
export function PawPattern() {
  return <div className="paw-bg" aria-hidden="true" />
}

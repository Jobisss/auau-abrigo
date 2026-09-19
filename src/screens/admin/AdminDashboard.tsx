import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogOut, MessageCircle, PawPrint } from 'lucide-react'
import { ConfirmDialog, CountUp, useToast } from '../../components/ui'
import { formatBRL, type AdminPet as Pet, type PetStatus } from '../../data/mock'
import { ApiError, api } from '../../lib/api'
import { useApp } from '../../state/AppState'

const FILTERS: { value: PetStatus; mobile: string; desktop: string }[] = [
  { value: 'pendente', mobile: 'Pendentes', desktop: 'Para aprovacao' },
  { value: 'ativo', mobile: 'Ativos', desktop: 'Ativos' },
  { value: 'oculto', mobile: 'Ocultos', desktop: 'Ocultos' },
]

const STATUS_LABEL: Record<PetStatus, string> = { pendente: 'Pendente', ativo: 'Ativo', oculto: 'Oculto' }

const EMPTY_TEXT: Record<PetStatus, string> = {
  pendente: 'Tudo em dia! Nenhum pet esperando aprovacao.',
  ativo: 'Nenhum pet ativo no Reels ainda.',
  oculto: 'Nenhum pet oculto.',
}

/** Tempo da animação de saída do card antes de mudar o estado. */
const LEAVE_MS = 280

const phoneLink = (contact: string) => `https://wa.me/55${contact.replace(/\D/g, '')}`
const money = (n: number) => formatBRL(Math.round(n)).replace(',00', '')

type Actions = Record<'approve' | 'hide' | 'remove', (p: Pet) => void>

/**
 * Lista do painel vinda da API. As ações mudam a tela na hora (otimista)
 * e voltam atrás, com aviso, se o servidor recusar.
 */
function useAdminPets(enabled: boolean, onError: (err: unknown) => void) {
  const [pets, setPets] = useState<Pet[] | null>(null)
  const petsRef = useRef<Pet[]>([])
  petsRef.current = pets ?? []
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    if (!enabled) return
    api.admin
      .list()
      .then(setPets)
      .catch((e) => onErrorRef.current(e))
  }, [enabled])

  const setStatus = useCallback((id: string, status: PetStatus) => {
    const prev = petsRef.current.find((p) => p.id === id)?.status
    if (!prev) return
    const apply = (s: PetStatus) => setPets((list) => list && list.map((p) => (p.id === id ? { ...p, status: s } : p)))
    apply(status)
    api.admin.setStatus(id, status).catch((e) => {
      apply(prev)
      onErrorRef.current(e)
    })
  }, [])

  const removePet = useCallback((id: string) => {
    const pet = petsRef.current.find((p) => p.id === id)
    if (!pet) return
    setPets((list) => list && list.filter((p) => p.id !== id))
    api.admin.remove(id).catch((e) => {
      setPets((list) => list && [pet, ...list].sort((a, b) => b.createdAt - a.createdAt))
      onErrorRef.current(e)
    })
  }, [])

  return { pets: pets ?? [], loading: pets === null, setStatus, removePet }
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { isAdmin, logout } = useApp()
  const [filter, setFilter] = useState<PetStatus>('pendente')
  const [leaving, setLeaving] = useState<string[]>([])
  const [confirming, setConfirming] = useState<Pet | null>(null)
  const [toast, showToast] = useToast()
  const closeConfirm = useCallback(() => setConfirming(null), [])
  const { pets, loading, setStatus, removePet } = useAdminPets(isAdmin === true, (err) => {
    // Sessão expirou no meio do caminho: volta pro login
    if (err instanceof ApiError && err.status === 401) return void logout()
    showToast({ message: (err as Error).message, tone: 'error' })
  })

  if (isAdmin === null) return null
  if (!isAdmin) return <Navigate to="/admin/login" replace />

  const count = (s: PetStatus) => pets.filter((p) => p.status === s).length
  const sum = (list: Pet[]) => list.reduce((acc, p) => acc + p.donation, 0)
  const raised = sum(pets.filter((p) => p.status !== 'pendente'))
  const pending = sum(pets.filter((p) => p.status === 'pendente'))
  const list = pets.filter((p) => p.status === filter)

  /** Anima o card saindo e só então aplica a mudança. */
  function animateOut(p: Pet, apply: () => void) {
    setLeaving((ids) => [...ids, p.id])
    setTimeout(() => {
      apply()
      setLeaving((ids) => ids.filter((id) => id !== p.id))
    }, LEAVE_MS)
  }

  const act: Actions = {
    approve: (p) =>
      animateOut(p, () => {
        setStatus(p.id, 'ativo')
        showToast({
          message: `${p.name} aprovado no Reels!`,
          tone: 'success',
          action: { label: 'Desfazer', onClick: () => setStatus(p.id, p.status) },
        })
      }),
    hide: (p) =>
      animateOut(p, () => {
        setStatus(p.id, 'oculto')
        showToast({
          message: `${p.name} ocultado`,
          action: { label: 'Desfazer', onClick: () => setStatus(p.id, p.status) },
        })
      }),
    remove: (p) => setConfirming(p),
  }

  function confirmRemove() {
    const p = confirming
    if (!p) return
    setConfirming(null)
    animateOut(p, () => {
      removePet(p.id)
      showToast({ message: `${p.name} removido`, tone: 'success' })
    })
  }

  const metrics = [
    { label: 'Valor total arrecadado', short: 'Arrecadado', value: raised, format: money, color: 'var(--blue)' },
    { label: 'Total pendente de confirmacao', short: 'Pendente', value: pending, format: money, color: 'var(--orange)' },
    { label: 'Para aprovacao', short: 'Para aprovar', value: count('pendente'), suffix: ' pets', color: 'var(--yellow)' },
    { label: 'Ativos no Reels', short: 'Ativos', value: count('ativo'), suffix: ' pets', color: 'var(--teal)' },
  ]

  const leavingClass = (p: Pet) => (leaving.includes(p.id) ? 'is-leaving' : '')

  return (
    <main className="admin cascade">
      <header className="admin-header">
        <div>
          <h1 className="title-hand">
            <span className="only-mobile">Aprovacao</span>
            <span className="only-desktop">Painel de aprovacao</span>
          </h1>
          <p className="muted">
            <span className="only-mobile">Gerencie pets e doacoes</span>
            <span className="only-desktop">Gerencie pets, doacoes e publicacoes no Reels</span>
          </p>
        </div>
        <button
          className="pill"
          onClick={async () => {
            await logout()
            navigate('/admin/login')
          }}
        >
          <LogOut size={16} strokeWidth={2.5} /> Sair
        </button>
      </header>

      <section className="metrics cascade" style={{ '--base': 50 } as CSSProperties}>
        {metrics.map((m) => (
          <div key={m.label} className="metric">
            <span className="metric-label">
              <span className="only-mobile">{m.short}</span>
              <span className="only-desktop">{m.label}</span>
            </span>
            <strong style={{ color: m.color }}>
              <CountUp value={m.value} format={m.format} />
              {m.suffix && <span className="only-desktop">{m.suffix}</span>}
            </strong>
          </div>
        ))}
      </section>

      <div className="row filters" style={{ '--gap': '8px' } as CSSProperties}>
        <span className="only-desktop h3" style={{ fontSize: 14 }}>
          Filtrar:
        </span>
        {FILTERS.map((f) => (
          <button key={f.value} className="pill" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            <span className="only-mobile">{f.mobile}</span>
            <span className="only-desktop">{f.desktop}</span>
            <span key={count(f.value)} className="pill-count">
              {count(f.value)}
            </span>
          </button>
        ))}
      </div>

      {!loading && list.length === 0 && (
        <div key={filter} className="admin-empty">
          <PawPrint size={32} />
          <p className="muted">{EMPTY_TEXT[filter]}</p>
        </div>
      )}

      {/* Mobile: cards */}
      <div key={`cards-${filter}`} className="admin-cards only-mobile cascade" style={{ '--base': 150 } as CSSProperties}>
        {list.map((p) => (
          <article key={p.id} className={`admin-card ${leavingClass(p)}`}>
            <span className={`pill pill--sm status status--${p.status}`}>{STATUS_LABEL[p.status]}</span>
            <div className="row" style={{ '--gap': '12px', alignItems: 'flex-start' } as CSSProperties}>
              <div className="admin-photo" style={{ backgroundImage: p.photo ? `url(${p.photo})` : undefined }} />
              <div className="stack grow" style={{ '--gap': '4px' } as CSSProperties}>
                <strong>
                  {p.name}, {p.age}
                </strong>
                <span className="admin-phone">{p.contact}</span>
                <span className="admin-value">Doacao: {formatBRL(p.donation)}</span>
              </div>
            </div>
            <ActionButtons pet={p} act={act} />
          </article>
        ))}
      </div>

      {/* Desktop: tabela */}
      {list.length > 0 && (
        <div key={`table-${filter}`} className="admin-table only-desktop cascade" style={{ '--base': 150 } as CSSProperties}>
          <div className="admin-tr admin-th">
            <span>Pet</span>
            <span>Contato</span>
            <span>Valor</span>
            <span>Status</span>
            <span>Acoes</span>
          </div>
          {list.map((p) => (
            <div key={p.id} className={`admin-tr ${leavingClass(p)}`}>
              <span className="row" style={{ '--gap': '10px' } as CSSProperties}>
                <span className="admin-avatar" style={{ backgroundImage: p.photo ? `url(${p.photo})` : undefined }}>
                  {!p.photo && <PawPrint size={16} />}
                </span>
                <strong>
                  {p.name}, {p.age}
                </strong>
              </span>
              <span className="admin-phone">{p.contact}</span>
              <span className="admin-value">{formatBRL(p.donation)}</span>
              <span>
                <span className={`pill pill--sm status status--${p.status}`} style={{ width: 110, justifyContent: 'center' }}>
                  {STATUS_LABEL[p.status]}
                </span>
              </span>
              <ActionButtons pet={p} act={act} />
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={`Remover ${confirming?.name ?? ''}?`}
        message="O pet sai do painel e do Reels. Essa acao nao pode ser desfeita."
        confirmLabel="Remover"
        onConfirm={confirmRemove}
        onCancel={closeConfirm}
      />
      {toast}
    </main>
  )
}

function ActionButtons({ pet, act }: { pet: Pet; act: Actions }) {
  return (
    <div className="row admin-actions" style={{ '--gap': '6px' } as CSSProperties}>
      {pet.status !== 'ativo' && (
        <button className="pill pill--sm pill--blue" onClick={() => act.approve(pet)}>
          Aprovar
        </button>
      )}
      {pet.status !== 'oculto' && (
        <button className="pill pill--sm" onClick={() => act.hide(pet)}>
          Ocultar
        </button>
      )}
      <button className="pill pill--sm pill--orange" onClick={() => act.remove(pet)}>
        Remover
      </button>
      <a
        className="pill pill--sm pill--teal admin-wa"
        href={phoneLink(pet.contact)}
        target="_blank"
        rel="noreferrer"
        aria-label={`WhatsApp de ${pet.name}`}
      >
        <MessageCircle size={14} strokeWidth={2.5} />
      </a>
    </div>
  )
}

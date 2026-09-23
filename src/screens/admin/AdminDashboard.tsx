import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, Eye, ExternalLink, ImagePlus, LogOut, MessageCircle, PawPrint, Sparkles, X } from 'lucide-react'
import { ConfirmDialog, CountUp, useToast } from '../../components/ui'
import { formatBRL, type AdminPet as Pet, type PetStatus } from '../../data/mock'
import { formatAge } from '../../lib/age'
import { ApiError, api } from '../../lib/api'
import { useApp } from '../../state/AppState'

const FILTERS: { value: PetStatus; mobile: string; desktop: string }[] = [
  { value: 'pendente', mobile: 'Pendentes', desktop: 'Para aprovação' },
  { value: 'ativo', mobile: 'Ativos', desktop: 'Ativos' },
  { value: 'oculto', mobile: 'Ocultos', desktop: 'Ocultos' },
]

const STATUS_LABEL: Record<PetStatus, string> = { pendente: 'Pendente', ativo: 'Ativo', oculto: 'Oculto' }

const EMPTY_TEXT: Record<PetStatus, string> = {
  pendente: 'Tudo em dia! Nenhum pet esperando aprovação.',
  ativo: 'Nenhum pet ativo no Reels ainda.',
  oculto: 'Nenhum pet oculto.',
}

/** Tempo da animação de saída do card antes de mudar o estado. */
const LEAVE_MS = 280
const DEFAULT_THANKS_MESSAGE = 'Esses doguinhos já ajudaram :)'

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
  const [previewing, setPreviewing] = useState<Pet | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [thanksMessage, setThanksMessage] = useState(DEFAULT_THANKS_MESSAGE)
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
  const selectable = list.filter((p) => p.status === 'ativo')
  const selected = pets.filter((p) => p.status === 'ativo' && selectedIds.includes(p.id))

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]))
  }

  function toggleAllVisible() {
    const allSelected = selectable.length > 0 && selectable.every((p) => selectedIds.includes(p.id))
    setSelectedIds((ids) => (allSelected ? ids.filter((id) => !selectable.some((p) => p.id === id)) : [...new Set([...ids, ...selectable.map((p) => p.id)])]))
  }

  function thanksUrl() {
    const message = thanksMessage.trim() || DEFAULT_THANKS_MESSAGE
    return `/obrigado?pets=${encodeURIComponent(selected.map((p) => p.id).join(','))}&mensagem=${encodeURIComponent(message)}`
  }

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
        setSelectedIds((ids) => ids.filter((id) => id !== p.id))
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
    { label: 'Total pendente de confirmação', short: 'Pendente', value: pending, format: money, color: 'var(--orange)' },
    { label: 'Para aprovação', short: 'Para aprovar', value: count('pendente'), suffix: ' pets', color: 'var(--yellow)' },
    { label: 'Ativos no Reels', short: 'Ativos', value: count('ativo'), suffix: ' pets', color: 'var(--teal)' },
  ]

  const leavingClass = (p: Pet) => (leaving.includes(p.id) ? 'is-leaving' : '')

  return (
    <main className="admin cascade">
      <header className="admin-header">
        <div>
          <h1 className="title-hand">
            <span className="only-mobile">Aprovação</span>
            <span className="only-desktop">Painel de aprovação</span>
          </h1>
          <p className="muted">
            <span className="only-mobile">Gerencie pets e doações</span>
            <span className="only-desktop">Gerencie pets, doações e publicações no Reels</span>
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

      {filter === 'ativo' && selectable.length > 0 && (
        <div className="admin-selection-toolbar">
          <button className="pill pill--sm" aria-pressed={selectable.every((p) => selectedIds.includes(p.id))} onClick={toggleAllVisible}>
            <Check size={15} strokeWidth={3} />
            {selectable.every((p) => selectedIds.includes(p.id)) ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
          <span className="muted">Escolha os doguinhos para a tela de agradecimento</span>
        </div>
      )}

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
              <button className="admin-photo admin-photo-button" onClick={() => setPreviewing(p)} aria-label={`Ver foto de ${p.name}`}>
                {p.photo ? <img src={p.photo} alt="" /> : <PawPrint size={24} />}
              </button>
              <div className="stack grow" style={{ '--gap': '4px' } as CSSProperties}>
                <strong>
                  {p.name}, {formatAge(p.age)}
                </strong>
                <span className="admin-phone">{p.contact}</span>
                <span className="admin-value">Doação: {formatBRL(p.donation)}</span>
              </div>
            </div>
            <ActionButtons pet={p} act={act} onPreview={setPreviewing} selected={selectedIds.includes(p.id)} onToggleSelected={toggleSelected} />
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
                {p.status === 'ativo' && (
                  <button
                    className={`admin-select-box ${selectedIds.includes(p.id) ? 'is-selected' : ''}`}
                    aria-label={`${selectedIds.includes(p.id) ? 'Remover' : 'Adicionar'} ${p.name} da tela de agradecimento`}
                    aria-pressed={selectedIds.includes(p.id)}
                    onClick={() => toggleSelected(p.id)}
                  >
                    {selectedIds.includes(p.id) && <Check size={14} strokeWidth={3} />}
                  </button>
                )}
                <button className="admin-avatar admin-avatar-button" onClick={() => setPreviewing(p)} aria-label={`Ver foto de ${p.name}`}>
                  {p.photo ? <img src={p.photo} alt="" /> : <PawPrint size={16} />}
                </button>
                <strong>
                  {p.name}, {formatAge(p.age)}
                </strong>
              </span>
              <span className="admin-phone">{p.contact}</span>
              <span className="admin-value">{formatBRL(p.donation)}</span>
              <span>
                <span className={`pill pill--sm status status--${p.status}`} style={{ width: 110, justifyContent: 'center' }}>
                  {STATUS_LABEL[p.status]}
                </span>
              </span>
              <ActionButtons pet={p} act={act} onPreview={setPreviewing} selected={selectedIds.includes(p.id)} onToggleSelected={toggleSelected} />
            </div>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <section className="admin-thanks-builder" aria-labelledby="thanks-builder-title">
          <div className="admin-thanks-builder-heading">
            <span className="admin-feature-icon"><Sparkles size={20} strokeWidth={2.5} /></span>
            <div>
              <h2 id="thanks-builder-title" className="h2">Montar tela de agradecimento</h2>
              <p className="muted">{selected.length} {selected.length === 1 ? 'pet selecionado' : 'pets selecionados'}</p>
            </div>
          </div>
          <div className="admin-thanks-pets" aria-label="Pets selecionados">
            {selected.map((p) => (
              <button key={p.id} className="admin-thanks-pet" onClick={() => toggleSelected(p.id)} aria-label={`Remover ${p.name}`}>
                {p.photo ? <img src={p.photo} alt={p.name} /> : <PawPrint size={18} />}
                <span>{p.name}</span>
                <span className="admin-thanks-pet-remove"><X size={12} /></span>
              </button>
            ))}
          </div>
          <label className="stack" style={{ '--gap': '6px' } as CSSProperties}>
            <span className="label">Mensagem da tela</span>
            <textarea
              className="input admin-thanks-input"
              value={thanksMessage}
              maxLength={120}
              onChange={(e) => setThanksMessage(e.target.value)}
              placeholder={DEFAULT_THANKS_MESSAGE}
              rows={2}
            />
          </label>
          <div className="row admin-thanks-actions" style={{ '--gap': '8px' } as CSSProperties}>
            <a className="btn btn--blue" href={thanksUrl()} target="_blank" rel="noreferrer">
              <ExternalLink size={19} strokeWidth={2.5} />
              Abrir tela personalizada
            </a>
            <button className="pill pill--sm" onClick={() => setSelectedIds([])}>Limpar seleção</button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={`Remover ${confirming?.name ?? ''}?`}
        message="O pet sai do painel e do Reels. Essa ação não pode ser desfeita."
        confirmLabel="Remover"
        onConfirm={confirmRemove}
        onCancel={closeConfirm}
      />
      <PhotoLightbox pet={previewing} onClose={() => setPreviewing(null)} />
      {toast}
    </main>
  )
}

function ActionButtons({
  pet,
  act,
  onPreview,
  selected,
  onToggleSelected,
}: {
  pet: Pet
  act: Actions
  onPreview: (pet: Pet) => void
  selected: boolean
  onToggleSelected: (id: string) => void
}) {
  return (
    <div className="row admin-actions" style={{ '--gap': '6px' } as CSSProperties}>
      {pet.status === 'ativo' && (
        <button
          className={`admin-select-box only-mobile ${selected ? 'is-selected' : ''}`}
          aria-label={`${selected ? 'Remover' : 'Adicionar'} ${pet.name} da tela de agradecimento`}
          aria-pressed={selected}
          onClick={() => onToggleSelected(pet.id)}
        >
          {selected && <Check size={14} strokeWidth={3} />}
        </button>
      )}
      <button className="pill pill--sm pill--white admin-view-photo" onClick={() => onPreview(pet)}>
        <Eye size={15} strokeWidth={2.5} />
        Ver foto
      </button>
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

function PhotoLightbox({ pet, onClose }: { pet: Pet | null; onClose: () => void }) {
  useEffect(() => {
    if (!pet) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [pet, onClose])

  if (!pet) return null

  return createPortal(
    <div className="photo-dialog-backdrop" onClick={onClose}>
      <div className="photo-dialog" role="dialog" aria-modal="true" aria-labelledby="photo-dialog-title" onClick={(event) => event.stopPropagation()}>
        <header className="photo-dialog-header">
          <div>
            <h2 id="photo-dialog-title" className="h2">Foto de {pet.name}</h2>
            <span className={`pill pill--sm status status--${pet.status}`}>{STATUS_LABEL[pet.status]}</span>
          </div>
          <button className="icon-btn" aria-label="Fechar foto" onClick={onClose}><X size={22} strokeWidth={2.5} /></button>
        </header>
        <div className="photo-dialog-media">
          {pet.photo ? <img src={pet.photo} alt={`Foto de ${pet.name}`} /> : <><ImagePlus size={42} /><span>Este pet não tem foto</span></>}
        </div>
        <p className="muted photo-dialog-caption">{pet.name}, {formatAge(pet.age)} · Doação: {formatBRL(pet.donation)}</p>
      </div>
    </div>,
    document.body,
  )
}

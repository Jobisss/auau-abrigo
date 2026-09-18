import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SEED_PETS, type Pet, type PetStatus } from '../data/mock'

/**
 * Estado global só de front-end (sem backend).
 * Persiste em localStorage para o fluxo sobreviver a um refresh.
 * Quando o backend existir, troque estas ações por chamadas de API.
 */

export type NewPet = Omit<Pet, 'id' | 'status' | 'likes' | 'createdAt' | 'donation'>

interface AppState {
  pets: Pet[]
  /** Pet que o usuário acabou de cadastrar (fluxo doação → obrigado). */
  draftPet: Pet | null
  donation: number | null
  liked: string[]
  isAdmin: boolean
  addPet: (pet: NewPet) => Pet
  setDonation: (value: number) => void
  setStatus: (id: string, status: PetStatus) => void
  removePet: (id: string) => void
  toggleLike: (id: string) => void
  login: () => void
  logout: () => void
}

const STORAGE_KEY = 'patinhas:v1'

interface Persisted {
  pets: Pet[]
  draftId: string | null
  donation: number | null
  liked: string[]
  isAdmin: boolean
}

function load(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Persisted) : null
  } catch {
    return null
  }
}

const Ctx = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(load, [])
  const [pets, setPets] = useState<Pet[]>(initial?.pets ?? SEED_PETS)
  const [draftId, setDraftId] = useState<string | null>(initial?.draftId ?? null)
  const [donation, setDonationState] = useState<number | null>(initial?.donation ?? null)
  const [liked, setLiked] = useState<string[]>(initial?.liked ?? [])
  const [isAdmin, setIsAdmin] = useState(initial?.isAdmin ?? false)

  useEffect(() => {
    const data: Persisted = { pets, draftId, donation, liked, isAdmin }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Foto em base64 pode estourar a cota — segue só em memória.
      try {
        const light = { ...data, pets: pets.map((p) => (p.photo.startsWith('data:') ? { ...p, photo: '' } : p)) }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(light))
      } catch {
        /* ignora */
      }
    }
  }, [pets, draftId, donation, liked, isAdmin])

  const addPet = useCallback((input: NewPet) => {
    const pet: Pet = {
      ...input,
      id: `${input.name.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`,
      status: 'pendente',
      likes: 0,
      donation: 0,
      createdAt: Date.now(),
    }
    setPets((list) => [pet, ...list])
    setDraftId(pet.id)
    setDonationState(null)
    return pet
  }, [])

  const setDonation = useCallback(
    (value: number) => {
      setDonationState(value)
      if (draftId) setPets((list) => list.map((p) => (p.id === draftId ? { ...p, donation: value } : p)))
    },
    [draftId],
  )

  const setStatus = useCallback((id: string, status: PetStatus) => {
    setPets((list) => list.map((p) => (p.id === id ? { ...p, status } : p)))
  }, [])

  const removePet = useCallback((id: string) => {
    setPets((list) => list.filter((p) => p.id !== id))
  }, [])

  const toggleLike = useCallback(
    (id: string) => {
      const has = liked.includes(id)
      setLiked(has ? liked.filter((x) => x !== id) : [...liked, id])
      setPets((list) => list.map((p) => (p.id === id ? { ...p, likes: p.likes + (has ? -1 : 1) } : p)))
    },
    [liked],
  )

  const value: AppState = {
    pets,
    draftPet: pets.find((p) => p.id === draftId) ?? null,
    donation,
    liked,
    isAdmin,
    addPet,
    setDonation,
    setStatus,
    removePet,
    toggleLike,
    login: () => setIsAdmin(true),
    logout: () => setIsAdmin(false),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp precisa estar dentro de <AppStateProvider>')
  return ctx
}

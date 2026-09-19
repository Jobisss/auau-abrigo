import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Pet } from '../data/mock'
import { api, type NewPetFields } from '../lib/api'

/**
 * Estado global. Os dados de verdade (pets, curtidas, aprovações) vivem na API;
 * o localStorage guarda só o que é deste aparelho: o pet que a pessoa acabou de
 * cadastrar (com o token pra informar a doação) e a lista do que ela já curtiu.
 */

export type FeedStatus = 'loading' | 'ready' | 'error'

interface Draft {
  pet: Pet
  /** Prova pra API que este aparelho cadastrou o pet (usado pra informar o valor doado). */
  token: string
}

interface AppState {
  /** Feed público: só pets aprovados. Carregado pelas telas que usam (reloadFeed). */
  pets: Pet[]
  feedStatus: FeedStatus
  reloadFeed: () => void
  /** Pet que o usuário acabou de cadastrar (fluxo doação → obrigado). */
  draftPet: Pet | null
  donation: number | null
  liked: string[]
  /** null enquanto confere a sessão com o servidor. */
  isAdmin: boolean | null
  addPet: (fields: NewPetFields, photo: Blob) => Promise<Pet>
  setDonation: (value: number) => void
  toggleLike: (id: string) => void
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const STORAGE_KEY = 'patinhas:v2'

interface Persisted {
  draft: Draft | null
  donation: number | null
  liked: string[]
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
  const [pets, setPets] = useState<Pet[]>([])
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('loading')
  const [draft, setDraft] = useState<Draft | null>(initial?.draft ?? null)
  const [donation, setDonationState] = useState<number | null>(initial?.donation ?? null)
  const [liked, setLiked] = useState<string[]>(initial?.liked ?? [])
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ draft, donation, liked } satisfies Persisted))
    } catch {
      /* modo privado / cota cheia — segue só em memória */
    }
  }, [draft, donation, liked])

  /** Busca o feed de novo. Quem já tem pets na tela não volta pro "carregando" — só troca a lista. */
  const reloadFeed = useCallback(() => {
    setFeedStatus((s) => (s === 'ready' ? s : 'loading'))
    api.pets
      .list()
      .then((list) => {
        setPets(list)
        setFeedStatus('ready')
      })
      .catch(() => setFeedStatus('error'))
  }, [])

  useEffect(() => {
    api.admin
      .me()
      .then((r) => setIsAdmin(r.admin))
      .catch(() => setIsAdmin(false))
  }, [])

  const addPet = useCallback(async (fields: NewPetFields, photo: Blob) => {
    const { pet, editToken } = await api.pets.create(fields, photo)
    setDraft({ pet, token: editToken })
    setDonationState(null)
    return pet
  }, [])

  const setDonation = useCallback(
    (value: number) => {
      setDonationState(value)
      if (!draft) return
      // O painel mostra esse valor como "pendente de confirmação"; se falhar, o comprovante no WhatsApp ainda vale.
      api.pets.setDonation(draft.pet.id, draft.token, value).catch((e) => console.warn('[doação]', e))
    },
    [draft],
  )

  const toggleLike = useCallback(
    (id: string) => {
      const willLike = !liked.includes(id)
      setLiked((list) => (willLike ? [...list, id] : list.filter((x) => x !== id)))
      setPets((list) => list.map((p) => (p.id === id ? { ...p, likes: Math.max(0, p.likes + (willLike ? 1 : -1)) } : p)))
      api.pets
        .like(id, willLike)
        .then(({ likes }) => setPets((list) => list.map((p) => (p.id === id ? { ...p, likes } : p))))
        .catch(() => {
          // Desfaz o otimista
          setLiked((list) => (willLike ? list.filter((x) => x !== id) : [...list, id]))
          setPets((list) => list.map((p) => (p.id === id ? { ...p, likes: Math.max(0, p.likes + (willLike ? -1 : 1)) } : p)))
        })
    },
    [liked],
  )

  const login = useCallback(async (email: string, password: string) => {
    await api.admin.login(email, password)
    setIsAdmin(true)
  }, [])

  const logout = useCallback(async () => {
    await api.admin.logout().catch(() => {})
    setIsAdmin(false)
  }, [])

  const value: AppState = {
    pets,
    feedStatus,
    reloadFeed,
    draftPet: draft?.pet ?? null,
    donation,
    liked,
    isAdmin,
    addPet,
    setDonation,
    toggleLike,
    login,
    logout,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp precisa estar dentro de <AppStateProvider>')
  return ctx
}

import { PIX_KEY_DISPLAY } from '../lib/pix'

export type PetStatus = 'pendente' | 'ativo' | 'oculto'

/** Pet como a API pública devolve (sem telefone do tutor nem valor doado). */
export interface Pet {
  id: string
  name: string
  age: string
  photo: string
  exoticFood: string
  adoptedHow: string
  favoritePlay: string
  status: PetStatus
  likes: number
  createdAt: number
}

/** Pet como o painel do abrigo enxerga. */
export interface AdminPet extends Pet {
  contact: string
  donation: number
}

/** Dados públicos do perfil @abrigotocadeassisivaipora. */
export const SHELTER = {
  name: 'Abrigo Toca de Assis',
  shortName: 'Toca de Assis',
  city: 'Ivaipora - PR',
  tagline: 'ONG de protecao animal em Ivaipora - PR.',
  mission:
    'Resgatamos animais feridos, em risco e vitimas de maus-tratos — caes, gatos e todo bichinho que precisar. Sua doacao ajuda com racao, veterinario e cuidados diarios e pode salvar vidas.',
  instagram: 'abrigotocadeassisivaipora',
  instagramUrl: 'https://www.instagram.com/abrigotocadeassisivaipora/',
  whatsapp: '43998664156',
  whatsappIntl: '5543998664156',
  pixKey: PIX_KEY_DISPLAY,
  stats: [
    { value: 'ONG', label: 'Protecao animal' },
    { value: '1000+', label: 'Seguidores' },
    { value: '100%', label: 'Pro abrigo' },
  ],
}

export const DONATION_PRESETS = [5, 10, 25]

export const waLink = (text?: string) =>
  `https://wa.me/${SHELTER.whatsappIntl}${text ? `?text=${encodeURIComponent(text)}` : ''}`

export const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatLikes = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n)

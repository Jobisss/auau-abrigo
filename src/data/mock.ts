import luizinha from '../assets/pet-luizinha.jpg'
import thor from '../assets/pet-thor.jpg'
import nina from '../assets/pet-nina.jpg'
import { PIX_KEY_DISPLAY } from '../lib/pix'

export type PetStatus = 'pendente' | 'ativo' | 'oculto'

export interface Pet {
  id: string
  name: string
  age: string
  photo: string
  exoticFood: string
  adoptedHow: string
  favoritePlay: string
  contact: string
  donation: number
  status: PetStatus
  likes: number
  createdAt: number
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

const now = Date.now()

export const SEED_PETS: Pet[] = [
  {
    id: 'luizinha',
    name: 'Luizinha',
    age: '5',
    photo: luizinha,
    exoticFood: 'Manga congelada',
    adoptedHow: 'Encontrado num parque',
    favoritePlay: 'Perseguir bolhas',
    contact: '(43) 99999-9999',
    donation: 15,
    status: 'ativo',
    likes: 2400,
    createdAt: now - 86400000 * 3,
  },
  {
    id: 'thor',
    name: 'Thor',
    age: '3',
    photo: thor,
    exoticFood: 'Casca de melancia',
    adoptedHow: 'Veio de uma feira de adoção',
    favoritePlay: 'Cabo de guerra',
    contact: '(43) 98888-7777',
    donation: 25,
    status: 'ativo',
    likes: 1870,
    createdAt: now - 86400000 * 2,
  },
  {
    id: 'nina',
    name: 'Nina',
    age: '2',
    photo: nina,
    exoticFood: 'Brócolis cozido',
    adoptedHow: 'Resgatada da chuva',
    favoritePlay: 'Esconder meias',
    contact: '(43) 97777-6666',
    donation: 10,
    status: 'pendente',
    likes: 0,
    createdAt: now - 86400000,
  },
]

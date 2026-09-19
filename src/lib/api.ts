import type { AdminPet, Pet, PetStatus } from '../data/mock'

/** Erro vindo da API — `message` já é o texto em português pra mostrar ao usuário. */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch {
    throw new ApiError(0, 'Sem conexão — confira a internet e tente de novo')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(res.status, body?.error ?? 'Algo deu errado — tente de novo')
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

const json = (method: string, body?: unknown, headers?: Record<string, string>): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
})

export interface NewPetFields {
  name: string
  age: string
  exoticFood: string
  adoptedHow: string
  favoritePlay: string
  contact: string
}

export const api = {
  pets: {
    list: () => request<Pet[]>('/pets'),

    /** Só responde pra pets aprovados (404 enquanto pendente/oculto). */
    get: (id: string) => request<Pet>(`/pets/${encodeURIComponent(id)}`),

    create(fields: NewPetFields, photo: Blob) {
      const form = new FormData()
      for (const [k, v] of Object.entries(fields)) form.append(k, v)
      form.append('photo', photo, 'pet.jpg')
      return request<{ pet: Pet; editToken: string }>('/pets', { method: 'POST', body: form })
    },

    setDonation: (id: string, editToken: string, amount: number) =>
      request<void>(`/pets/${encodeURIComponent(id)}/donation`, json('PUT', { amount }, { 'X-Edit-Token': editToken })),

    like: (id: string, liked: boolean) => request<{ likes: number }>(`/pets/${encodeURIComponent(id)}/like`, json('POST', { liked })),
  },

  admin: {
    me: () => request<{ admin: boolean }>('/admin/me'),
    login: (email: string, password: string) => request<void>('/admin/login', json('POST', { email, password })),
    logout: () => request<void>('/admin/logout', json('POST')),
    list: () => request<AdminPet[]>('/admin/pets'),
    setStatus: (id: string, status: PetStatus) =>
      request<AdminPet>(`/admin/pets/${encodeURIComponent(id)}`, json('PATCH', { status })),
    remove: (id: string) => request<void>(`/admin/pets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
}

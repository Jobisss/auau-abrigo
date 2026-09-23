export const DEFAULT_THANKS_MESSAGE = 'Esses pets já ajudaram :)'
export const PETS_PER_THANKS_STORY = 4

/** Também atualiza links de agradecimento criados com o texto antigo. */
export function thanksMessage(value: string | null) {
  return (value?.trim().replace(/doguinhos/gi, 'pets') || DEFAULT_THANKS_MESSAGE).slice(0, 120)
}

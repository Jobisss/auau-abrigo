/**
 * Idade do pet: "anos.meses" — o número depois do ponto são MESES, não fração de ano.
 *   "3"   → 3 anos
 *   "0.6" → 6 meses
 *   "1.3" → 1 ano e 3 meses
 * Aceita vírgula no lugar do ponto. Usado pelo front e pelo servidor.
 */

export interface Age {
  years: number
  months: number
}

const AGE_RE = /^(\d{1,2})(?:[.,](\d{1,2}))?$/

export function parseAge(input: string): Age | null {
  const m = input.trim().match(AGE_RE)
  if (!m) return null
  const years = Number(m[1])
  const months = m[2] ? Number(m[2]) : 0
  if (months > 11 || years > 40 || (years === 0 && months === 0)) return null
  return { years, months }
}

/** Forma guardada no banco: "3", "0.6", "1.3". */
export const serializeAge = ({ years, months }: Age) => (months ? `${years}.${months}` : String(years))

/** "3 anos", "6 meses", "1 ano e 3 meses". Idade que não segue o formato aparece como veio. */
export function formatAge(value: string) {
  const age = parseAge(value)
  if (!age) return value
  const y = age.years === 1 ? '1 ano' : `${age.years} anos`
  const m = age.months === 1 ? '1 mes' : `${age.months} meses`
  if (!age.months) return y
  if (!age.years) return m
  return `${y} e ${m}`
}

import { createStaticPix, hasError } from 'pix-utils'

/**
 * O DICT (diretório de chaves do Banco Central) só reconhece a chave no formato "cru":
 * CPF/CNPJ só com números, telefone +55DDDNUMERO, e-mail minúsculo, aleatória como está.
 * Chave com pontuação (ex.: CNPJ "12.345.678/0001-90") gera um PIX que o banco recusa como inválido.
 */
export function normalizePixKey(input: string) {
  const key = input.trim()
  if (!key) return ''
  // Chave aleatória (EVP)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return key.toLowerCase()
  if (key.includes('@')) return key.toLowerCase()

  const digits = key.replace(/\D/g, '')
  if (key.startsWith('+')) return `+${digits}`
  // Telefone escrito com DDD entre parênteses: (43) 99999-9999
  if (/^\(\d{2}\)/.test(key)) return `+55${digits}`
  // CPF (11) ou CNPJ (14), com ou sem pontuação
  if (/^[\d.\-/\s]+$/.test(key) && (digits.length === 11 || digits.length === 14)) return digits
  return key
}

/** Nome e cidade no BR Code: sem acento e dentro do limite de tamanho. */
const plain = (s: string, max: number) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .slice(0, max)

export const PIX_KEY = normalizePixKey(import.meta.env.VITE_PIX_KEY ?? '')
/** Sem chave no .env o app esconde QR/copia-e-cola e orienta a doar pelo WhatsApp. */
export const PIX_ENABLED = PIX_KEY.length > 0
const MERCHANT_NAME = plain(import.meta.env.VITE_PIX_MERCHANT_NAME || 'Abrigo Toca de Assis', 25)
const MERCHANT_CITY = plain(import.meta.env.VITE_PIX_MERCHANT_CITY || 'Ivaipora', 15)

export interface PixCharge {
  brCode: string
  qrImage: string
}

/** Gera o PIX copia-e-cola (BR Code) e o QR Code em base64 para o valor informado. */
export async function createPixCharge(amount: number, info = 'Doacao pro abrigo'): Promise<PixCharge> {
  if (!PIX_KEY) throw new Error('VITE_PIX_KEY não configurada no .env')

  const pix = createStaticPix({
    merchantName: MERCHANT_NAME,
    merchantCity: MERCHANT_CITY,
    pixKey: PIX_KEY,
    infoAdicional: info,
    transactionAmount: Number(amount.toFixed(2)),
  })

  if (hasError(pix)) throw new Error(`Erro ao gerar PIX: ${pix.message}`)

  return { brCode: pix.toBRCode(), qrImage: await pix.toImage() }
}

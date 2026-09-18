import { createStaticPix, hasError } from 'pix-utils'

export const PIX_KEY = (import.meta.env.VITE_PIX_KEY ?? '').trim()
/** Sem chave no .env o app esconde QR/copia-e-cola e orienta a doar pelo WhatsApp. */
export const PIX_ENABLED = PIX_KEY.length > 0
const MERCHANT_NAME = import.meta.env.VITE_PIX_MERCHANT_NAME || 'Abrigo Toca de Assis'
const MERCHANT_CITY = import.meta.env.VITE_PIX_MERCHANT_CITY || 'Ivaipora'

/** Chave para exibição: tira o +55 de chaves de telefone. */
export const PIX_KEY_DISPLAY = PIX_KEY.replace(/^\+55/, '')

export interface PixCharge {
  brCode: string
  qrImage: string
}

/** Gera o PIX copia-e-cola (BR Code) e o QR Code em base64 para o valor informado. */
export async function createPixCharge(amount: number, info = 'Doacao pro abrigo'): Promise<PixCharge> {
  if (!PIX_KEY) throw new Error('VITE_PIX_KEY não configurada no .env')

  const pix = createStaticPix({
    merchantName: MERCHANT_NAME.slice(0, 25),
    merchantCity: MERCHANT_CITY.slice(0, 15),
    pixKey: PIX_KEY,
    infoAdicional: info,
    transactionAmount: Number(amount.toFixed(2)),
  })

  if (hasError(pix)) throw new Error(`Erro ao gerar PIX: ${pix.message}`)

  return { brCode: pix.toBRCode(), qrImage: await pix.toImage() }
}

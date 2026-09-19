import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CircleAlert, Copy, MessageCircle, QrCode } from 'lucide-react'
import { SupportNote, haptic, useToast } from '../components/ui'
import { DONATION_PRESETS, SHELTER, formatBRL } from '../data/mock'
import { PIX_ENABLED, createPixCharge, type PixCharge } from '../lib/pix'
import { useApp } from '../state/AppState'

type Choice = number | 'outro'

function parseBRL(v: string) {
  const n = Number(v.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function maskMoney(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 7)
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export default function Donation() {
  const navigate = useNavigate()
  const { donation, setDonation } = useApp()
  const initial: Choice = donation == null || DONATION_PRESETS.includes(donation) ? (donation ?? 5) : 'outro'
  const [choice, setChoice] = useState<Choice>(initial)
  const [custom, setCustom] = useState(initial === 'outro' && donation ? maskMoney(String(donation * 100)) : '')
  const [generated, setGenerated] = useState<number | null>(initial === 'outro' ? donation : null)
  const [copied, setCopied] = useState(false)
  const [toast, showToast] = useToast()

  useEffect(() => {
    if (donation == null) setDonation(5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const amount = choice === 'outro' ? generated : choice
  const [charge, setCharge] = useState<PixCharge | null>(null)
  const [pixError, setPixError] = useState<string | null>(null)

  useEffect(() => {
    setCharge(null)
    setPixError(null)
    setCopied(false)
    if (!amount || !PIX_ENABLED) return
    let alive = true
    createPixCharge(amount)
      .then((c) => alive && setCharge(c))
      .catch((e: Error) => alive && setPixError(e.message))
    return () => {
      alive = false
    }
  }, [amount])

  // "Copiado!" volta ao normal depois de um tempinho
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(t)
  }, [copied])

  const code = charge?.brCode ?? null

  function pick(c: Choice) {
    setChoice(c)
    if (c !== 'outro') setDonation(c)
  }

  function generate() {
    const v = parseBRL(custom)
    if (v < 1) return showToast({ message: 'Valor mínimo: R$ 1,00', tone: 'error' })
    setGenerated(v)
    setDonation(v)
  }

  async function copy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      /* sem permissão de clipboard — segue só o feedback visual */
    }
    haptic()
    setCopied(true)
    showToast({ message: 'Código PIX copiado! Cole no app do seu banco', tone: 'success' })
  }

  return (
    <main className="screen cascade">
      <h1 className="title-hand" style={{ marginTop: 16 }}>
        Quase lá, bichinho!
      </h1>
      <p className="muted" style={{ fontSize: 15 }}>
        Falta só a doação para liberar seu pet no Reels.
      </p>

      <section className="card" style={{ padding: 14 }}>
        <h2 className="card-title" style={{ fontSize: 16 }}>
          <CircleAlert size={18} color="var(--orange)" strokeWidth={2.4} />
          Seu pet ainda não aparece no Reels!
        </h2>
        <p className="card-body">
          Para aprovar seu pet, faça a doação e envie o comprovante no WhatsApp. Liberamos seu bichinho!
        </p>
      </section>

      <div className="row" style={{ '--gap': '10px' } as CSSProperties}>
        <span className="step-num">1</span>
        <h2 className="h3">Escolha o valor da doação pro abrigo</h2>
      </div>

      <div className="row amount-row" role="radiogroup" aria-label="Valor da doação">
        {DONATION_PRESETS.map((v) => (
          <button
            key={v}
            className="pill amount"
            role="radio"
            aria-checked={choice === v}
            aria-pressed={choice === v}
            onClick={() => pick(v)}
          >
            R$ {v}
          </button>
        ))}
        <button
          className="pill amount"
          role="radio"
          aria-checked={choice === 'outro'}
          aria-pressed={choice === 'outro'}
          onClick={() => pick('outro')}
        >
          Outro
        </button>
      </div>

      <section className="card card--lg pix-card">
        {choice === 'outro' && (
          <label className="field">
            <span className="h3" style={{ fontSize: 14 }}>
              Digite o valor da doação
            </span>
            <div className="input-prefix">
              <span>R$</span>
              <input
                autoFocus
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="15,00"
                value={custom}
                onChange={(e) => {
                  setCustom(maskMoney(e.target.value))
                  setGenerated(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && custom && generate()}
                aria-label="Valor em reais"
              />
            </div>
          </label>
        )}

        {amount && !PIX_ENABLED ? (
          <div className="pix-empty">
            <QrCode size={28} strokeWidth={2} color="var(--ink-soft)" />
            <strong style={{ color: 'var(--ink)' }}>PIX do abrigo em breve</strong>
            <span>
              Você escolheu {formatBRL(amount)}. A chave PIX ainda não está no app — combine a doação pelo WhatsApp
              abaixo.
            </span>
          </div>
        ) : amount ? (
          <>
            <div
              key={amount}
              className={`qr-box ${charge || pixError ? '' : 'skeleton'}`}
              aria-label={`QR Code PIX de ${formatBRL(amount)}`}
              aria-busy={!charge && !pixError}
            >
              {charge ? (
                <img src={charge.qrImage} alt={`QR Code PIX de ${formatBRL(amount)}`} />
              ) : pixError ? (
                <span className="field-error" style={{ padding: 8, textAlign: 'center' }}>
                  {pixError}
                </span>
              ) : null}
            </div>
            <span className="h3" style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
              Código PIX copia e cola · {formatBRL(amount)}
            </span>
            <div
              className={['pix-code', !code && 'skeleton', copied && 'is-flash'].filter(Boolean).join(' ')}
              title={code ?? ''}
            >
              {code ?? 'Gerando código PIX...'}
            </div>
            <button className={`btn ${copied ? 'btn--success' : 'btn--yellow'}`} onClick={copy} disabled={!code}>
              {copied ? <Check key="ok" size={20} strokeWidth={3} /> : <Copy key="copy" size={20} strokeWidth={2.5} />}
              {copied ? 'Copiado!' : 'Copiar código PIX'}
            </button>
          </>
        ) : (
          <>
            <div className="pix-empty">
              <QrCode size={28} strokeWidth={2} color="var(--ink-soft)" />
              <span>{PIX_ENABLED ? 'O QR Code e o código PIX aparecem aqui após gerar.' : 'Digite o valor e confirme.'}</span>
            </div>
            <button className="btn btn--blue" onClick={generate} disabled={!custom}>
              {PIX_ENABLED ? <QrCode size={20} strokeWidth={2.5} /> : <Check size={20} strokeWidth={2.5} />}
              {PIX_ENABLED ? 'Gerar código PIX' : 'Confirmar valor'}
            </button>
          </>
        )}
      </section>

      <div className="stack" style={{ '--gap': '10px', marginTop: 8 } as CSSProperties}>
        <div className="row" style={{ '--gap': '10px' } as CSSProperties}>
          <span className="step-num">2</span>
          <span>Envie o comprovante no WhatsApp</span>
        </div>
        <div className="row" style={{ '--gap': '10px' } as CSSProperties}>
          <span className="step-num">3</span>
          <span>Liberamos o seu bichinho no Reels!</span>
        </div>
      </div>

      <section className="card card--md card--teal" style={{ padding: 16 }}>
        <h2 className="h3">Envie o comprovante aqui</h2>
        <span className="big-link" style={{ fontSize: 24 }}>
          wa.me/{SHELTER.whatsapp}
        </span>
        <span className="card-body" style={{ color: 'var(--ink-soft)' }}>
          Número: {SHELTER.whatsapp}
        </span>
        <SupportNote />
      </section>

      <button className="btn btn--blue" onClick={() => navigate('/enviar-comprovante')} disabled={!amount}>
        <MessageCircle size={20} strokeWidth={2.5} />
        Enviar comprovante no WhatsApp
      </button>
      <p className="footer-note">E liberamos o seu bichinho! &lt;3</p>
      {toast}
    </main>
  )
}

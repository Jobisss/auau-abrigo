import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ExternalLink, MessageCircle } from 'lucide-react'
import { SupportNote } from '../components/ui'
import { SHELTER, formatBRL, waLink } from '../data/mock'
import { formatAge } from '../lib/age'
import { track } from '../lib/analytics'
import { useApp } from '../state/AppState'

export default function SendReceipt() {
  const navigate = useNavigate()
  const { draftPet, donation } = useApp()
  /** Depois de abrir o WhatsApp, destacamos o botão de continuar. */
  const [opened, setOpened] = useState(false)

  const message = [
    'Oi! Segue o comprovante da doação pro abrigo',
    donation ? `(${formatBRL(donation)})` : '',
    draftPet ? `— pet: ${draftPet.name}, ${formatAge(draftPet.age)}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className="screen screen--center cascade">
      <div className="pulse-icon">
        <MessageCircle size={48} strokeWidth={2.2} />
      </div>
      <h1 className="title-hand" style={{ textAlign: 'center' }}>
        Enviar comprovante
      </h1>
      <p className="muted" style={{ textAlign: 'center', fontSize: 15, lineHeight: '23px' }}>
        Você será redirecionado para o WhatsApp para enviar o comprovante da doação.
      </p>

      <section className="card card--teal">
        <span className="label">Abrir link externo</span>
        <span className="big-link">wa.me/{SHELTER.whatsapp}</span>
        <span className="card-body" style={{ color: 'var(--ink-soft)' }}>
          Número: {SHELTER.whatsapp}
        </span>
        <SupportNote />
      </section>

      <a className="btn btn--blue" href={waLink(message)} target="_blank" rel="noreferrer" onClick={() => {
          setOpened(true)
          track('comprovante_whatsapp')
        }}>
        Abrir WhatsApp
        <ExternalLink size={18} strokeWidth={2.5} className="btn-icon-end" />
      </a>
      <p key={String(opened)} className={`muted hint-text ${opened ? 'is-active' : ''}`}>
        {opened ? 'Enviou? Toque abaixo para continuar' : 'Após enviar, volte e continue'}
      </p>
      <button className={`btn btn--yellow ${opened ? 'btn--attention' : ''}`} onClick={() => navigate('/obrigado')}>
        Já enviei — continuar
        <ArrowRight size={20} strokeWidth={2.5} className="btn-icon-end" />
      </button>
    </main>
  )
}

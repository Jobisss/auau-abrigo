import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Apple, Camera, CircleAlert, Footprints, HeartHandshake, ImagePlus, Phone, RefreshCw, Send } from 'lucide-react'
import { PawPattern, ScreenHeader, haptic } from '../components/ui'
import { resizeImage } from '../lib/image'
import { useApp } from '../state/AppState'

interface Form {
  name: string
  age: string
  exoticFood: string
  adoptedHow: string
  favoritePlay: string
  contact: string
}

const EMPTY: Form = { name: '', age: '', exoticFood: '', adoptedHow: '', favoritePlay: '', contact: '' }

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export default function AddPet() {
  const navigate = useNavigate()
  const { addPet } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLButtonElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const ageRef = useRef<HTMLInputElement>(null)
  const contactRef = useRef<HTMLInputElement>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  /** URL local só pra pré-visualizar — a foto só sobe pro servidor ao publicar. */
  const [photo, setPhoto] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  /** Incrementa a cada envio inválido — remonta os erros e repete o "shake". */
  const [attempt, setAttempt] = useState(0)

  const set = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'contact' ? maskPhone(e.target.value) : e.target.value }))

  const errors = {
    photo: !photo && 'Adicione uma foto do seu pet',
    name: !form.name.trim() && 'Obrigatorio',
    age: !form.age.trim() && 'Obrigatorio',
    contact: form.contact.replace(/\D/g, '').length < 10 && 'Numero invalido',
  }
  const touched = attempt > 0

  useEffect(() => {
    if (!photoFile) return
    const url = URL.createObjectURL(photoFile)
    setPhoto(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  function loadFile(file?: File) {
    if (!file || !file.type.startsWith('image/')) return
    setPhotoFile(file)
    setSubmitError('')
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    loadFile(e.dataTransfer.files?.[0])
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (sending) return
    const firstInvalid = [
      errors.photo && photoRef,
      errors.name && nameRef,
      errors.age && ageRef,
      errors.contact && contactRef,
    ].find(Boolean)

    if (firstInvalid || !photoFile) {
      setAttempt((a) => a + 1)
      haptic(40)
      const el = firstInvalid ? firstInvalid.current : photoRef.current
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus({ preventScroll: true })
      return
    }

    setSending(true)
    setSubmitError('')
    try {
      // Campos opcionais vazios viram "—" no servidor
      await addPet(
        {
          name: form.name.trim(),
          age: form.age.replace(/\D/g, '') || form.age.trim(),
          exoticFood: form.exoticFood.trim(),
          adoptedHow: form.adoptedHow.trim(),
          favoritePlay: form.favoritePlay.trim(),
          contact: form.contact,
        },
        await resizeImage(photoFile),
      )
      navigate('/doacao')
    } catch (err) {
      setSubmitError((err as Error).message)
      haptic(40)
    } finally {
      setSending(false)
    }
  }

  const err = (k: keyof typeof errors) =>
    touched && errors[k] ? (
      <span key={attempt} className="field-error">
        <CircleAlert size={13} strokeWidth={2.5} />
        {errors[k]}
      </span>
    ) : null

  const invalid = (k: keyof typeof errors) => (touched && Boolean(errors[k])) || undefined

  return (
    <main className="screen screen--paws cascade">
      <PawPattern />
      <ScreenHeader title="Adicione o Seu pet !" back="/" />
      <p className="muted" style={{ fontSize: 15 }}>
        mostre seu animalzinho para todos ! &lt;3
      </p>

      <form
        className="stack add-pet-form cascade"
        style={{ '--gap': '18px', '--base': 150 } as CSSProperties}
        onSubmit={onSubmit}
        noValidate
      >
        <div className="field">
          <span className="h3">Foto do pet</span>
          <button
            ref={photoRef}
            type="button"
            className={['photo-upload', photo && 'has-photo', dragging && 'is-dragging'].filter(Boolean).join(' ')}
            aria-invalid={invalid('photo')}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={photo ? { backgroundImage: `url(${photo})` } : undefined}
          >
            {photo ? (
              <span className="photo-change">
                <RefreshCw size={14} strokeWidth={2.5} /> Trocar foto
              </span>
            ) : dragging ? (
              <>
                <ImagePlus size={36} color="var(--blue)" strokeWidth={2} />
                <span className="photo-hint">Solte a foto aqui</span>
              </>
            ) : (
              <>
                <Camera size={32} color="var(--sky)" strokeWidth={2} />
                <span className="photo-hint">Toque para adicionar foto</span>
                <span className="photo-format">Formato 9:16 (vertical)</span>
                <span className="photo-detail">Ideal para aparecer no Reels em tela cheia</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              loadFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {err('photo')}
        </div>

        <div className="row" style={{ '--gap': '12px', alignItems: 'flex-start' } as CSSProperties}>
          <Field label="Nome" className="grow" error={err('name')}>
            <input
              ref={nameRef}
              className="input"
              placeholder="Luizinha"
              value={form.name}
              onChange={set('name')}
              maxLength={24}
              aria-invalid={invalid('name')}
            />
          </Field>
          <Field label="Idade" style={{ width: 120 }} error={err('age')}>
            <input
              ref={ageRef}
              className="input"
              placeholder="5 anos"
              value={form.age}
              onChange={set('age')}
              maxLength={10}
              aria-invalid={invalid('age')}
            />
          </Field>
        </div>

        <Field label="Comida exotica favorita" icon={<Apple size={16} />}>
          <input className="input" placeholder="Manga congelada" value={form.exoticFood} onChange={set('exoticFood')} />
        </Field>
        <Field label="Como foi adotado" icon={<HeartHandshake size={16} />}>
          <input className="input" placeholder="Encontrado num parque" value={form.adoptedHow} onChange={set('adoptedHow')} />
        </Field>
        <Field label="Brincadeira favorita" icon={<Footprints size={16} />}>
          <input className="input" placeholder="Perseguir bolhas" value={form.favoritePlay} onChange={set('favoritePlay')} />
        </Field>
        <Field label="O seu numero para contato" icon={<Phone size={16} />} error={err('contact')}>
          <input
            ref={contactRef}
            className="input"
            placeholder="(43) 99999-9999"
            inputMode="tel"
            autoComplete="tel"
            value={form.contact}
            onChange={set('contact')}
            aria-invalid={invalid('contact')}
          />
        </Field>

        {submitError && (
          <span className="field-error" role="alert">
            <CircleAlert size={13} strokeWidth={2.5} />
            {submitError}
          </span>
        )}
        <button type="submit" className="btn btn--blue" style={{ marginTop: 6 }} disabled={sending} aria-busy={sending}>
          {sending ? 'Enviando…' : 'Publicar pet'}
          <Send size={20} strokeWidth={2.5} className="btn-icon-end" />
        </button>
      </form>
    </main>
  )
}

function Field({
  label,
  icon,
  error,
  children,
  className = '',
  style,
}: {
  label: string
  icon?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <label className={`field ${className}`} style={style}>
      <span className="field-label">
        {icon}
        {label}
      </span>
      {children}
      {error}
    </label>
  )
}

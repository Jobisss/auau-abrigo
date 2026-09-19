import { useState, type CSSProperties, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CircleAlert, Eye, EyeOff, LogIn } from 'lucide-react'
import { haptic } from '../../components/ui'
import { useApp } from '../../state/AppState'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { isAdmin, login } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [sending, setSending] = useState(false)

  if (isAdmin) return <Navigate to="/admin" replace />

  function fail(message: string) {
    setError(message)
    setAttempt((a) => a + 1)
    haptic(40)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (sending) return
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) return fail('Confira o e-mail e a senha.')

    setSending(true)
    try {
      await login(email, password)
      navigate('/admin')
    } catch (err) {
      fail((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="admin-login">
      <form className="admin-login-box cascade" onSubmit={onSubmit} noValidate>
        <h1 className="title-hand" style={{ textAlign: 'center', fontSize: 36 }}>
          Painel do abrigo
        </h1>
        <p className="muted" style={{ textAlign: 'center', lineHeight: '21px' }}>
          Entre para gerenciar aprovações e doações
        </p>

        <div className="stack" style={{ '--gap': '14px' } as CSSProperties}>
          <label className="field" style={{ gap: 6 }}>
            <span className="label">E-mail</span>
            <input
              className="input admin-input"
              type="email"
              autoComplete="username"
              placeholder="admin@abrigo.com"
              value={email}
              aria-invalid={Boolean(error) || undefined}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
            />
          </label>
          <label className="field" style={{ gap: 6 }}>
            <span className="label">Senha</span>
            <div className="input-wrap">
              <input
                className="input admin-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="********"
                value={password}
                aria-invalid={Boolean(error) || undefined}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
              />
              <button
                type="button"
                className="input-toggle"
                aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && (
            <span key={attempt} className="field-error" role="alert">
              <CircleAlert size={13} strokeWidth={2.5} />
              {error}
            </span>
          )}
          <button type="submit" className="btn btn--blue" disabled={sending} aria-busy={sending}>
            <LogIn size={20} strokeWidth={2.5} />
            <span className="only-mobile">Entrar</span>
            <span className="only-desktop">Entrar no painel</span>
          </button>
        </div>
      </form>
    </main>
  )
}

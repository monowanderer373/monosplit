import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'
import { supabaseEnabled } from '../lib/supabase'

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

function mapAuthError(err: unknown, t: (k: Parameters<ReturnType<typeof useT>>[0]) => string): string {
  const msg = err instanceof Error ? err.message.toLowerCase() : ''
  if (msg.includes('not-configured')) return t('auth.errorNotConfigured')
  if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong password')) return t('auth.errorCredentials')
  return t('auth.errorGeneric')
}

export default function LoginPage() {
  const t = useT()
  const navigate = useNavigate()
  const { signIn, signInWithGoogle } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      navigate('/')
    } catch (err) {
      setError(mapAuthError(err, t))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(mapAuthError(err, t))
      setGoogleLoading(false)
    }
  }

  return (
    <main className="ms-page flex min-h-dvh items-center justify-center pb-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[var(--ms-text)]">MonoSplit</h1>
          <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">{t('auth.signInTitle')}</p>
        </div>

        <div className="ms-card-soft space-y-4 p-5">
          {!supabaseEnabled && (
            <p className="text-xs text-[var(--ms-danger)] border border-[var(--ms-danger)] bg-[var(--ms-danger-bg)] p-2">
              {t('auth.errorNotConfigured')}
            </p>
          )}

          {supabaseEnabled && (
            <button
              type="button"
              disabled={googleLoading}
              onClick={handleGoogle}
              className="ms-btn-ghost flex h-11 w-full items-center justify-center gap-2 font-medium"
            >
              {googleLoading ? (
                <span className="text-sm text-[var(--ms-text-secondary)]">{t('auth.signingIn')}</span>
              ) : (
                <>
                  <GoogleIcon />
                  <span className="text-sm">{t('auth.google')}</span>
                </>
              )}
            </button>
          )}

          {supabaseEnabled && (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--ms-border)]" />
              <span className="text-xs text-[var(--ms-text-muted)]">{t('auth.orDivider')}</span>
              <div className="h-px flex-1 bg-[var(--ms-border)]" />
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-3">
            <label className="block text-xs font-medium text-[var(--ms-text-secondary)]">
              {t('auth.email')}
              <input
                type="email"
                autoComplete="email"
                className="ms-input mt-1 h-11 w-full"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="block text-xs font-medium text-[var(--ms-text-secondary)]">
              {t('auth.password')}
              <input
                type="password"
                autoComplete="current-password"
                className="ms-input mt-1 h-11 w-full"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error && (
              <p className="text-xs text-[var(--ms-danger)]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !supabaseEnabled}
              className="ms-btn-primary h-11 w-full"
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          <p className="text-center text-xs text-[var(--ms-text-secondary)]">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="font-semibold text-[var(--ms-accent)]">
              {t('auth.signUp')}
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-[var(--ms-text-muted)] underline-offset-2 hover:underline">
            {t('auth.continueWithout')}
          </Link>
        </div>
      </div>
    </main>
  )
}

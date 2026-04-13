import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
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

function mapAuthError(err: unknown, t: ReturnType<typeof useT>): string {
  const msg = err instanceof Error ? err.message.toLowerCase() : ''
  if (msg.includes('not-configured')) return t('auth.errorNotConfigured')
  if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong password')) return t('auth.errorCredentials')
  return t('auth.errorGeneric')
}

export default function LoginPage() {
  const t = useT()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'
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
      navigate(redirect, { replace: true })
    } catch (err) {
      setError(mapAuthError(err, t))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    if (redirect && redirect !== '/') window.localStorage.setItem('ms_post_auth_redirect', redirect)
    try {
      await signInWithGoogle(redirect !== '/' ? redirect : undefined)
    } catch (err) {
      setError(mapAuthError(err, t))
      setGoogleLoading(false)
    }
  }

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
      style={{ background: 'var(--ms-bg, #f4f0e8)' }}
    >
      {/* Logo + title */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-md"
          style={{ background: 'var(--ms-accent, #8b6e4e)', color: '#fdfaf5' }}
        >
          ✈
        </div>
        <h1
          className="text-3xl font-bold uppercase tracking-widest"
          style={{ color: 'var(--ms-text, #2c2520)', fontFamily: "'Departure Mono', monospace" }}
        >
          Mono Split
        </h1>
        <p
          className="text-xs uppercase tracking-widest"
          style={{ color: 'var(--ms-text-secondary, #6b6058)', fontFamily: "'Departure Mono', monospace" }}
        >
          {t('auth.loginTagline')}
        </p>
      </div>

      {/* Login card */}
      <div
        className="w-full max-w-sm rounded-2xl border p-6 shadow-lg"
        style={{
          background: 'var(--ms-surface, #faf8f4)',
          borderColor: 'var(--ms-border, #d8d0c4)',
        }}
      >
        {!supabaseEnabled && (
          <p
            className="mb-4 rounded-lg border p-2 text-xs"
            style={{ borderColor: 'var(--ms-danger, #9e4a4a)', color: 'var(--ms-danger, #9e4a4a)', background: 'var(--ms-danger-bg)' }}
          >
            {t('auth.errorNotConfigured')}
          </p>
        )}

        {/* Google button */}
        {supabaseEnabled && (
          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogle}
            className="mb-4 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border font-medium transition-colors"
            style={{
              borderColor: 'var(--ms-border, #d8d0c4)',
              color: 'var(--ms-text, #2c2520)',
              background: 'var(--ms-bg, #f4f0e8)',
            }}
          >
            {googleLoading ? (
              <span className="text-sm" style={{ color: 'var(--ms-text-secondary, #6b6058)' }}>{t('auth.signingIn')}</span>
            ) : (
              <>
                <GoogleIcon />
                <span className="text-sm">{t('auth.google')}</span>
              </>
            )}
          </button>
        )}

        {/* Divider */}
        {supabaseEnabled && (
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'var(--ms-border, #d8d0c4)' }} />
            <span className="text-xs" style={{ color: 'var(--ms-text-muted, #9a9088)', fontFamily: "'Departure Mono', monospace" }}>
              {t('auth.orDivider')}
            </span>
            <div className="h-px flex-1" style={{ background: 'var(--ms-border, #d8d0c4)' }} />
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label
              className="mb-1 block text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--ms-text-secondary, #6b6058)', fontFamily: "'Departure Mono', monospace" }}
            >
              {t('auth.email')}
            </label>
            <input
              type="email"
              autoComplete="email"
              className="ms-input h-11 w-full"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              className="mb-1 block text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--ms-text-secondary, #6b6058)', fontFamily: "'Departure Mono', monospace" }}
            >
              {t('auth.password')}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              className="ms-input h-11 w-full"
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: 'var(--ms-danger, #9e4a4a)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !supabaseEnabled}
            className="h-11 w-full rounded-xl font-semibold uppercase tracking-widest transition-opacity disabled:opacity-50"
            style={{
              background: 'var(--ms-accent, #8b6e4e)',
              color: '#fdfaf5',
              fontFamily: "'Departure Mono', monospace",
              fontSize: '0.8rem',
            }}
          >
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>

        <p className="mt-4 text-center text-xs" style={{ color: 'var(--ms-text-secondary, #6b6058)' }}>
          {t('auth.noAccount')}{' '}
          <Link
            to={`/signup${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: 'var(--ms-accent, #8b6e4e)' }}
          >
            {t('auth.signUp')}
          </Link>
        </p>
      </div>

      <div className="mt-5 text-center">
        <Link
          to={redirect !== '/' ? redirect : '/'}
          className="text-xs underline-offset-2 hover:underline"
          style={{ color: 'var(--ms-text-muted, #9a9088)' }}
        >
          {t('auth.continueWithout')}
        </Link>
      </div>
    </main>
  )
}

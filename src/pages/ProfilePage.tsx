import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'
import { authErrorKey, safeInternalRedirect } from '../lib/authUi'
import { useStore } from '../store/useStore'

function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[a-z]/i.test(password) && /\d/.test(password)
}

export default function ProfilePage() {
  const t = useT()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lang = useStore((state) => state.lang)
  const setLang = useStore((state) => state.setLang)
  const {
    authUser,
    loading,
    signOut,
    updateProfile,
    linkAnonymousEmail,
    setAccountPassword,
  } = useAuth()

  const [displayNameDraft, setDisplayName] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState('')
  const [upgradeEmail, setUpgradeEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountAction, setAccountAction] = useState<'idle' | 'sending' | 'password'>('idle')
  const [accountMessage, setAccountMessage] = useState('')
  const [showGuestSignOutWarning, setShowGuestSignOutWarning] = useState(false)
  const displayName = displayNameDraft ?? authUser?.displayName ?? ''
  const intendedRedirect = safeInternalRedirect(searchParams.get('redirect')) ?? '/profile'
  const preserveSessionNotice = searchParams.get('upgrade') === 'preserve-session'

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return
    setSaveError('')
    setSaveStatus('saving')
    try {
      await updateProfile({ displayName: displayName.trim() })
      setDisplayName(null)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveError(t('auth.errorGeneric'))
      setSaveStatus('idle')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleLinkEmail = async () => {
    if (!upgradeEmail.trim()) return
    setAccountAction('sending')
    setAccountMessage('')
    try {
      await linkAnonymousEmail(
        upgradeEmail.trim(),
        `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(intendedRedirect)}`,
      )
      setAccountMessage(t('auth.profile.verificationSent'))
    } catch (cause) {
      setAccountMessage(t(authErrorKey(cause)))
    } finally {
      setAccountAction('idle')
    }
  }

  const handleSetPassword = async () => {
    if (!isStrongPassword(password)) return
    setAccountAction('password')
    setAccountMessage('')
    try {
      await setAccountPassword(password)
      setPassword('')
      setAccountMessage(t('auth.profile.passwordUpdated'))
    } catch (cause) {
      setAccountMessage(t(authErrorKey(cause)))
    } finally {
      setAccountAction('idle')
    }
  }

  if (loading) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <p className="text-sm text-[var(--ms-text-secondary)]">{t('expense.loading')}</p>
      </main>
    )
  }

  if (!authUser) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <div className="ms-card-soft w-full max-w-sm space-y-3 p-5 text-center">
          <p className="text-sm text-[var(--ms-text-secondary)]">{t('auth.signInToSave')}</p>
          <button className="ms-btn-primary w-full" onClick={() => navigate('/login')}>
            {t('auth.signIn')}
          </button>
          <button className="ms-btn-ghost w-full" onClick={() => navigate('/')}>
            {t('common.back')} · {t('common.ledger')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="ms-page pb-10">
      <header className="mb-6 flex items-center justify-between">
        <button className="ms-btn-ghost" onClick={() => navigate('/')}>
          {t('common.back')} · {t('common.ledger')}
        </button>
        <button
          className="ms-btn-ghost text-[var(--ms-danger)]"
          title={authUser.isAnonymous ? t('auth.profile.signOutRisk') : undefined}
          onClick={() => authUser.isAnonymous ? setShowGuestSignOutWarning(true) : void handleSignOut()}
        >
          {t('auth.signOut')}
        </button>
      </header>

      {showGuestSignOutWarning ? (
        <section className="ms-card-hero mb-5 border border-[var(--ms-danger)] p-5">
          <p className="ms-label text-[var(--ms-danger)]">{t('auth.profile.signOutWarningTitle')}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ms-text-secondary)]">
            {t('auth.profile.signOutWarningHelp')}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="ms-btn-ghost" onClick={() => setShowGuestSignOutWarning(false)}>{t('auth.profile.keepSession')}</button>
            <button className="ms-btn-primary bg-[var(--ms-danger)]" onClick={() => void handleSignOut()}>{t('auth.profile.signOutAnyway')}</button>
          </div>
        </section>
      ) : null}

      <section className="ms-card-soft mb-5 p-5">
        <h2 className="ms-title">{t('lang.title')}</h2>
        <p className="mt-1 text-xs text-[var(--ms-text-muted)]">{t('lang.desc')}</p>
        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={t('lang.title')}>
          <button
            className={lang === 'en' ? 'ms-btn-primary' : 'ms-btn-ghost'}
            aria-pressed={lang === 'en'}
            onClick={() => setLang('en')}
          >
            EN
          </button>
          <button
            className={lang === 'zh' ? 'ms-btn-primary' : 'ms-btn-ghost'}
            aria-pressed={lang === 'zh'}
            onClick={() => setLang('zh')}
          >
            简中
          </button>
        </div>
      </section>

      {preserveSessionNotice && authUser.isAnonymous ? (
        <section className="ms-card-hero mb-5 p-5" role="status">
          <p className="ms-label">{t('auth.profile.preserveTitle')}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ms-text-secondary)]">
            {t('auth.profile.preserveHelp')}
          </p>
        </section>
      ) : null}

      <section className="ms-card-soft mb-5 p-5">
        <h2 className="ms-title mb-4">{t('auth.account')}</h2>

        <div className="space-y-1 mb-4">
          <p className="text-xs text-[var(--ms-text-muted)]">{t('auth.email')}</p>
          <p className="text-sm font-medium text-[var(--ms-text)]">
            {authUser.isAnonymous ? t('auth.profile.guestSession') : authUser.email}
          </p>
        </div>

        <label className="block text-xs font-medium text-[var(--ms-text-secondary)]">
          {t('auth.editDisplayName')}
          <input
            type="text"
            className="ms-input mt-1 h-11 w-full"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('auth.displayNamePlaceholder')}
          />
        </label>

        {saveError && <p className="mt-2 text-xs text-[var(--ms-danger)]">{saveError}</p>}

        <button
          className="ms-btn-primary mt-3 w-full"
          disabled={saveStatus === 'saving' || !displayName.trim()}
          onClick={handleSaveProfile}
        >
          {saveStatus === 'saving'
            ? t('auth.saving')
            : saveStatus === 'saved'
              ? t('auth.saved')
              : t('auth.saveProfile')}
        </button>
      </section>

      {authUser.isAnonymous ? (
        <section className="ms-card-hero mb-5 p-5">
          <p className="ms-label">{t('auth.profile.keepAccess')}</p>
          <h2 className="mt-1 text-xl font-extrabold">{t('auth.profile.linkTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ms-text-secondary)]">
            {t('auth.profile.linkHelp')}
          </p>
          <label className="mt-4 block text-xs font-bold text-[var(--ms-text-secondary)]">
            {t('auth.email')}
            <input
              className="ms-input mt-1 w-full"
              type="email"
              autoComplete="email"
              value={upgradeEmail}
              onChange={(event) => setUpgradeEmail(event.target.value)}
            />
          </label>
          <button className="ms-btn-primary mt-3 w-full" disabled={accountAction !== 'idle' || !upgradeEmail.trim()} onClick={() => void handleLinkEmail()}>
            {accountAction === 'sending' ? t('auth.profile.sending') : t('auth.profile.sendVerification')}
          </button>
          {accountMessage ? <p className="mt-3 text-xs leading-5 text-[var(--ms-text-secondary)]" aria-live="polite">{accountMessage}</p> : null}
        </section>
      ) : (
        <section className="ms-card-soft mb-5 p-5">
          <h2 className="ms-title mb-2">{t('auth.profile.passwordTitle')}</h2>
          <p className="text-xs leading-5 text-[var(--ms-text-muted)]">
            {t('auth.profile.passwordHelp')}
          </p>
          <label className="mt-3 block text-xs font-bold text-[var(--ms-text-secondary)]">
            {t('auth.profile.newPassword')}
            <input
              className="ms-input mt-1 w-full"
              type="password"
              autoComplete="new-password"
              minLength={8}
              pattern="(?=.*[A-Za-z])(?=.*\d).{8,}"
              aria-describedby="profile-password-help"
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <p id="profile-password-help" className="mt-1 text-[11px] leading-4 text-[var(--ms-text-muted)]">
            {t('auth.passwordHelp')}
          </p>
          <button className="ms-btn-ghost mt-3 w-full" disabled={accountAction !== 'idle' || !isStrongPassword(password)} onClick={() => void handleSetPassword()}>
            {accountAction === 'password' ? t('auth.profile.updating') : t('auth.profile.setPassword')}
          </button>
          {accountMessage ? <p className="mt-3 text-xs text-[var(--ms-text-secondary)]" aria-live="polite">{accountMessage}</p> : null}
        </section>
      )}
    </main>
  )
}

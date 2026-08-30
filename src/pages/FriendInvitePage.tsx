import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { friendRepository } from '../lib/friendRepository'
import { friendlyErrorKey, useT, type TranslationKey } from '../lib/i18n'

export default function FriendInvitePage() {
  const t = useT()
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { authUser, loading } = useAuth()
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<TranslationKey | ''>('')

  const accept = async () => {
    if (!authUser || authUser.isAnonymous || accepting) return
    setAccepting(true)
    setError('')
    try {
      await friendRepository.acceptInvite(token)
      navigate('/friends', { replace: true })
    } catch (cause) {
      setError(friendlyErrorKey(cause))
      setAccepting(false)
    }
  }

  return (
    <main className="ms-page flex min-h-dvh items-center justify-center">
      <section className="ms-card-hero w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--ms-bg-warm)] text-3xl">🐾</div>
        <p className="ms-label mt-4">{t('friendInvite.label')}</p>
        <h1 className="mt-2 text-3xl font-extrabold">{t('friendInvite.title')}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ms-text-secondary)]">
          {t('friendInvite.help')}
        </p>

        {loading ? (
          <p className="mt-5 text-sm text-[var(--ms-text-muted)]">{t('friendInvite.checking')}</p>
        ) : !authUser ? (
          <button
            className="ms-btn-primary mt-6 w-full"
            onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/friend-invite/${token}`)}`)}
          >
            {t('friendInvite.signIn')}
          </button>
        ) : authUser.isAnonymous ? (
          <>
            <p className="mt-5 rounded-xl bg-[var(--ms-info-bg)] px-3 py-2 text-sm text-[var(--ms-info)]">
              {t('friendInvite.linkHelp')}
            </p>
            <button className="ms-btn-primary mt-3 w-full" onClick={() => navigate('/profile')}>{t('friendInvite.link')}</button>
          </>
        ) : (
          <button className="ms-btn-primary mt-6 w-full" disabled={accepting} onClick={() => void accept()}>
            {accepting ? t('friendInvite.accepting') : t('friendInvite.accept')}
          </button>
        )}

        {error ? <p className="mt-4 rounded-xl bg-[var(--ms-danger-bg)] px-3 py-2 text-sm text-[var(--ms-danger)]">{t(error)}</p> : null}
        <button className="mt-5 text-sm font-bold text-[var(--ms-text-secondary)]" onClick={() => navigate('/')}>{t('friendInvite.notNow')}</button>
      </section>
    </main>
  )
}

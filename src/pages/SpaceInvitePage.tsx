import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { spaceRepository } from '../lib/spaceRepository'
import type { GroupRole, SpaceType } from '../types'
import { friendlyErrorKey, roleKey, useT, type TranslationKey } from '../lib/i18n'

type Preview = {
  spaceId: string
  spaceName: string
  spaceType: SpaceType
  role: Exclude<GroupRole, 'owner'>
  expiresAt: string
}

export default function SpaceInvitePage() {
  const t = useT()
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { authUser, loading, signInAnonymously } = useAuth()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [checking, setChecking] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<TranslationKey | ''>('')

  useEffect(() => {
    let active = true
    void spaceRepository.previewInvite(token).then((result) => {
      if (!active) return
      setPreview(result)
      setChecking(false)
      if (!result) setError('spaceInvite.invalid')
    })
    return () => {
      active = false
    }
  }, [token])

  const join = async (asGuest: boolean) => {
    if (!preview || joining) return
    setJoining(true)
    setError('')
    try {
      if (!authUser) {
        if (!asGuest) {
          navigate(`/login?redirect=${encodeURIComponent(`/space-invite/${token}`)}`)
          return
        }
        await signInAnonymously()
      }
      const spaceId = await spaceRepository.acceptInvite(token)
      navigate(`/space/${spaceId}`, { replace: true })
    } catch (cause) {
      setError(friendlyErrorKey(cause))
      setJoining(false)
    }
  }

  return (
    <main className="ms-page flex min-h-dvh items-center justify-center">
      <section className="ms-card-hero w-full max-w-md text-center">
        <p className="ms-label">{t('spaceInvite.label')}</p>
        {checking || loading ? (
          <p className="mt-5 text-sm text-[var(--ms-text-secondary)]">{t('spaceInvite.checking')}</p>
        ) : preview ? (
          <>
            <div className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--ms-bg-warm)] text-3xl">
              {preview.spaceType === 'trip' ? '🧳' : '🐾'}
            </div>
            <h1 className="mt-4 text-3xl font-extrabold">{preview.spaceName}</h1>
            <p className="mt-2 text-sm text-[var(--ms-text-secondary)]">
              {t('spaceInvite.invitedRole', { role: t(roleKey(preview.role)) })}
            </p>
            {authUser ? (
              <button className="ms-btn-primary mt-6 w-full" disabled={joining} onClick={() => void join(false)}>
                {joining ? t('spaceInvite.joining') : t('spaceInvite.join')}
              </button>
            ) : (
              <>
                <button className="ms-btn-primary mt-6 w-full" disabled={joining} onClick={() => void join(true)}>
                  {joining ? t('spaceInvite.joining') : t('spaceInvite.guest')}
                </button>
                <button className="ms-btn-ghost mt-2 w-full" disabled={joining} onClick={() => void join(false)}>
                  {t('spaceInvite.signIn')}
                </button>
                <p className="mt-3 text-xs leading-5 text-[var(--ms-text-muted)]">
                  {t('spaceInvite.guestHelp')}
                </p>
              </>
            )}
          </>
        ) : null}

        {error ? (
          <p className="mt-5 rounded-xl bg-[var(--ms-danger-bg)] px-3 py-2 text-sm text-[var(--ms-danger)]">
            {t(error)}
          </p>
        ) : null}
        <button className="mt-5 text-sm font-bold text-[var(--ms-text-secondary)]" onClick={() => navigate('/spaces')}>{t('space.back')}</button>
      </section>
    </main>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../store/useStore'
import { useT } from '../lib/i18n'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { formatDateRange } from '../lib/format'
import type { Group } from '../types'

type OwnedGroupRow = { id: string; group: Group }

export default function ProfilePage() {
  const t = useT()
  const navigate = useNavigate()
  const { authUser, loading, signOut, updateProfile } = useAuth()
  const groups = useStore((s) => s.groups)

  const [displayName, setDisplayName] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState('')
  const [ownedGroups, setOwnedGroups] = useState<OwnedGroupRow[]>([])
  const [ownedLoading, setOwnedLoading] = useState(false)

  useEffect(() => {
    if (authUser) setDisplayName(authUser.displayName ?? '')
  }, [authUser])

  useEffect(() => {
    if (!authUser || !supabase || !supabaseEnabled) return
    setOwnedLoading(true)
    supabase
      .from('groups')
      .select('id, data')
      .eq('owner_id', authUser.id)
      .then(({ data }) => {
        if (data) {
          setOwnedGroups(
            data
              .filter((r) => r.data)
              .map((r) => ({ id: r.id, group: { ...(r.data as Group), id: r.id } })),
          )
        }
        setOwnedLoading(false)
      })
  }, [authUser])

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return
    setSaveError('')
    setSaveStatus('saving')
    try {
      await updateProfile({ displayName: displayName.trim() })
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
            {t('auth.backToGroups')}
          </button>
        </div>
      </main>
    )
  }

  const localOnlyGroups = groups.filter(
    (g) => !ownedGroups.some((o) => o.id === g.id),
  )

  return (
    <main className="ms-page pb-10">
      <header className="mb-6 flex items-center justify-between">
        <button className="ms-btn-ghost" onClick={() => navigate('/')}>
          {t('auth.backToGroups')}
        </button>
        <button className="ms-btn-ghost text-[var(--ms-danger)]" onClick={handleSignOut}>
          {t('auth.signOut')}
        </button>
      </header>

      <section className="ms-card-soft mb-5 p-5">
        <h2 className="ms-title mb-4">{t('auth.account')}</h2>

        <div className="space-y-1 mb-4">
          <p className="text-xs text-[var(--ms-text-muted)]">{t('auth.email')}</p>
          <p className="text-sm font-medium text-[var(--ms-text)]">{authUser.email}</p>
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

      <section className="ms-card-soft mb-5 p-5">
        <h2 className="ms-title mb-4">{t('auth.myGroups')}</h2>

        {ownedLoading ? (
          <p className="text-sm text-[var(--ms-text-muted)]">{t('expense.loading')}</p>
        ) : ownedGroups.length === 0 ? (
          <p className="text-sm text-[var(--ms-text-muted)]">{t('auth.noOwnedGroups')}</p>
        ) : (
          <div className="space-y-2">
            {ownedGroups.map(({ id, group }) => (
              <article
                key={id}
                className="ms-card-soft cursor-pointer p-3"
                onClick={() => navigate(`/group/${id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ms-text)]">{group.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--ms-text-secondary)]">
                      {group.people.length} {t('groups.people')} · {group.expenses.length} {t('groups.expenses')}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--ms-text-muted)]">
                      {formatDateRange(group.startDate, group.endDate)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--ms-success)]">● {t('auth.groupClaimed')}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {localOnlyGroups.length > 0 && (
        <section className="ms-card-soft p-5">
          <h2 className="text-sm font-semibold text-[var(--ms-text-secondary)] mb-3">
            Local groups (not saved to account)
          </h2>
          <div className="space-y-2">
            {localOnlyGroups.map((group) => (
              <article
                key={group.id}
                className="ms-card-soft cursor-pointer p-3"
                onClick={() => navigate(`/group/${group.id}`)}
              >
                <p className="text-sm font-semibold text-[var(--ms-text)]">{group.name}</p>
                <p className="mt-0.5 text-xs text-[var(--ms-text-secondary)]">
                  {group.people.length} {t('groups.people')} · {group.expenses.length} {t('groups.expenses')}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

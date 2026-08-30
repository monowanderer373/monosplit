import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { spaceRepository, type SpaceWithRole } from '../lib/spaceRepository'
import type { SpaceType } from '../types'
import {
  friendlyErrorKey,
  roleKey,
  spaceTypeKey,
  useT,
  type TranslationKey,
} from '../lib/i18n'
import { formatDate } from '../lib/locale'
import { useStore } from '../store/useStore'

export default function SpacesPage() {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const navigate = useNavigate()
  const { authUser, loading: authLoading } = useAuth()
  const [spaces, setSpaces] = useState<SpaceWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<SpaceType>('trip')
  const [currency, setCurrency] = useState(authUser?.defaultCurrency ?? 'MYR')
  const [error, setError] = useState<TranslationKey | ''>('')

  const refresh = useCallback(async () => {
    if (!authUser?.participantId) {
      setSpaces([])
      setLoading(false)
      return
    }
    try {
      setSpaces(await spaceRepository.list())
      setError('')
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setLoading(false)
    }
  }, [authUser?.participantId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createSpace = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    setError('')
    try {
      const id = await spaceRepository.create({
        type,
        name: name.trim(),
        startDate: null,
        endDate: null,
        defaultCurrency: currency,
      })
      navigate(`/space/${id}`)
    } catch (cause) {
      setError(friendlyErrorKey(cause))
      setCreating(false)
    }
  }

  if (authLoading) {
    return <main className="ms-page flex min-h-dvh items-center justify-center">{t('spaces.opening')}</main>
  }

  if (!authUser) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <section className="ms-card-hero w-full max-w-md text-center">
          <p className="ms-label">{t('spaces.sharedExpenses')}</p>
          <h1 className="mt-2 text-3xl font-extrabold">{t('spaces.signInTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ms-text-secondary)]">
            {t('spaces.signInHelp')}
          </p>
          <button className="ms-btn-primary mt-6 w-full" onClick={() => navigate('/login')}>{t('common.signIn')}</button>
          <button className="ms-btn-ghost mt-2 w-full" onClick={() => navigate('/')}>{t('spaces.backLedger')}</button>
        </section>
      </main>
    )
  }

  return (
    <main className="ms-page pb-28">
      <header className="mx-auto flex max-w-4xl items-start justify-between gap-4">
        <div>
          <p className="ms-label">{t('app.title')}</p>
          <h1 className="mt-1 text-3xl font-extrabold">{t('spaces.title')}</h1>
          <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">{t('spaces.subtitle')}</p>
        </div>
        <button className="ms-btn-ghost" onClick={() => navigate('/')}>{t('common.ledger')}</button>
      </header>

      {!authUser.isAnonymous ? (
        <section className="ms-card-hero mx-auto mt-6 max-w-4xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs font-bold text-[var(--ms-text-secondary)]">
              {t('spaces.name')}
              <input
                className="ms-input mt-1 w-full"
                placeholder={type === 'trip' ? t('spaces.tripPlaceholder') : t('spaces.groupPlaceholder')}
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void createSpace()
                }}
              />
            </label>
            <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
              {t('spaces.type')}
              <select className="ms-input mt-1 w-full sm:w-32" value={type} onChange={(event) => setType(event.target.value as SpaceType)}>
                <option value="trip">{t('spaceType.trip')}</option>
                <option value="group">{t('spaceType.group')}</option>
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
              {t('spaces.currency')}
              <input className="ms-input mt-1 w-full uppercase sm:w-28" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
            </label>
            <button className="ms-btn-primary h-11 sm:w-auto" disabled={creating || !name.trim()} onClick={() => void createSpace()}>
              {creating ? t('common.creating') : t('spaces.create')}
            </button>
          </div>
        </section>
      ) : (
        <section className="ms-card mx-auto mt-6 max-w-4xl">
          <p className="font-bold">{t('spaces.guestSession')}</p>
          <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">
            {t('spaces.guestHelp')}
          </p>
        </section>
      )}

      {error ? (
        <p className="mx-auto mt-4 max-w-4xl rounded-xl bg-[var(--ms-danger-bg)] px-4 py-3 text-sm text-[var(--ms-danger)]">
          {t(error)}
        </p>
      ) : null}

      <section className="mx-auto mt-8 max-w-4xl">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="ms-label">{t('spaces.yourAccess')}</p>
            <h2 className="mt-1 text-xl font-extrabold">{t('spaces.active')}</h2>
          </div>
          <button className="ms-btn-ghost py-2 text-sm" onClick={() => void refresh()}>{t('common.refresh')}</button>
        </div>

        {loading ? (
          <div className="ms-card p-6 text-sm text-[var(--ms-text-secondary)]">{t('spaces.loading')}</div>
        ) : spaces.length === 0 ? (
          <div className="ms-card-hero text-center">
            <p className="text-4xl">🐾</p>
            <h3 className="mt-3 text-xl font-extrabold">{t('spaces.emptyTitle')}</h3>
            <p className="mt-2 text-sm text-[var(--ms-text-secondary)]">
              {t('spaces.emptyHelp')}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {spaces.map(({ space, role }) => (
              <button
                key={space.id}
                className="ms-card text-left transition-transform hover:-translate-y-0.5"
                onClick={() => navigate(`/space/${space.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="ms-label">{t(spaceTypeKey(space.type))}</p>
                    <h3 className="mt-1 truncate text-xl font-extrabold">{space.name}</h3>
                  </div>
                  <span className="rounded-full bg-[var(--ms-bg-warm)] px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide">
                    {t(roleKey(role))}
                  </span>
                </div>
                <p className="mt-5 text-sm text-[var(--ms-text-secondary)]">
                  {space.defaultCurrency} · {space.startDate ? formatDate(space.startDate, lang) : t('spaces.noDates')}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

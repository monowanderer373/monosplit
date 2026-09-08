import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { ledgerRepository } from '../lib/ledgerRepository'
import {
  friendRepository,
  type ParticipantLinkRequest,
} from '../lib/friendRepository'
import { personRepository } from '../lib/personRepository'
import { formatMinorAmount } from '../lib/money'
import {
  countKey,
  friendlyErrorKey,
  personStateKey,
  useT,
  type TranslationKey,
} from '../lib/i18n'
import { formatDate } from '../lib/locale'
import { useStore } from '../store/useStore'
import type { PersonRelationship } from '../types'

export default function FriendsPage() {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const navigate = useNavigate()
  const { authUser, loading: authLoading } = useAuth()
  const participantId = authUser?.participantId ?? null
  const ledger = usePersonalLedger()
  const refreshLedger = ledger.refresh
  const [people, setPeople] = useState<PersonRelationship[]>([])
  const [linkRequests, setLinkRequests] = useState<ParticipantLinkRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<TranslationKey | ''>('')
  const [manualName, setManualName] = useState('')
  const [action, setAction] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')

  const refresh = useCallback(async () => {
    if (!authUser?.participantId || authUser.isAnonymous) {
      setLoading(false)
      return
    }
    try {
      const [nextPeople, nextLinkRequests] = await Promise.all([
        personRepository.listPeople(),
        friendRepository.listLinkRequests(),
        refreshLedger(),
      ])
      setPeople(nextPeople)
      setLinkRequests(nextLinkRequests)
      setError('')
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setLoading(false)
    }
  }, [authUser?.isAnonymous, authUser?.participantId, refreshLedger])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(
    () => personRepository.subscribeToPeople(() => void refresh()),
    [refresh],
  )

  const pendingExpenses = useMemo(() => ledger.expenses.filter((expense) => (
    expense.scope === 'direct'
    && expense.status === 'active'
    && expense.participations.some((participation) => (
      participation.participantId === participantId && participation.state === 'pending'
    ))
  )), [ledger.expenses, participantId])
  const incomingLinkRequests = linkRequests.filter((request) => (
    request.targetParticipantId === participantId && request.status === 'pending'
  ))

  const createInvite = async () => {
    if (action) return
    setAction('invite')
    setError('')
    try {
      const token = await friendRepository.createInvite()
      const url = `${window.location.origin}/friend-invite/${token}`
      setInviteUrl(url)
      await navigator.clipboard?.writeText(url)
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  const addManual = async () => {
    if (!manualName.trim() || action) return
    setAction('manual')
    setError('')
    try {
      await personRepository.createManualPerson(manualName.trim())
      setManualName('')
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  const respond = async (expenseId: string, response: 'accepted' | 'declined') => {
    if (action) return
    setAction(expenseId)
    setError('')
    try {
      await ledgerRepository.respondToDirectExpense(expenseId, response)
      await ledger.refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  const respondManualLink = async (requestId: string, response: 'accepted' | 'declined') => {
    if (action) return
    setAction(`link:${requestId}`)
    setError('')
    try {
      await friendRepository.respondManualLink(requestId, response)
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  if (authLoading) {
    return <main className="ms-page flex min-h-dvh items-center justify-center">{t('friends.opening')}</main>
  }

  if (!authUser || authUser.isAnonymous || !participantId) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <section className="ms-card-hero w-full max-w-md text-center">
          <p className="ms-label">{t('friends.title')}</p>
          <h1 className="mt-2 text-3xl font-extrabold">{t('friends.accountRequired')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ms-text-secondary)]">
            {t('friends.accountHelp')}
          </p>
          <button className="ms-btn-primary mt-6 w-full" onClick={() => navigate(authUser ? '/profile' : '/login')}>
            {authUser ? t('friends.linkAccount') : t('common.signIn')}
          </button>
          <button className="ms-btn-ghost mt-2 w-full" onClick={() => navigate('/')}>{t('common.back')}</button>
        </section>
      </main>
    )
  }

  return (
    <main className="ms-page pb-28">
      <header className="mx-auto flex max-w-4xl items-start justify-between gap-4">
        <div>
          <p className="ms-label">{t('friends.directLabel')}</p>
          <h1 className="mt-1 text-3xl font-extrabold">{t('friends.title')}</h1>
          <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">{t('friends.subtitle')}</p>
        </div>
        <button className="ms-btn-ghost" onClick={() => navigate('/')}>{t('common.ledger')}</button>
      </header>

      {error ? <p className="mx-auto mt-4 max-w-4xl rounded-xl bg-[var(--ms-danger-bg)] px-4 py-3 text-sm text-[var(--ms-danger)]">{t(error)}</p> : null}

      {pendingExpenses.length > 0 ? (
        <section className="mx-auto mt-6 max-w-4xl">
          <p className="ms-label">{t('friends.needsAnswer')}</p>
          <div className="mt-2 grid gap-3">
            {pendingExpenses.map((expense) => {
              const mine = expense.participations.find((participation) => participation.participantId === participantId)
              const myShare = expense.shares.find((share) => share.expenseParticipationId === mine?.id)?.amountMinor ?? 0
              const payerNames = expense.payerContributions
                .map((contribution) => expense.participations.find(
                  (participation) => participation.id === contribution.expenseParticipationId,
                )?.nameSnapshot)
                .filter((name): name is string => Boolean(name))
                .join(', ')
              return (
                <article key={expense.id} className="ms-card-hero">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-extrabold">{expense.description ?? expense.category}</p>
                      <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">
                        {t('friends.share', { amount: formatMinorAmount(myShare, expense.currency), date: formatDate(expense.occurredOn, lang) })}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
                        {t('friends.total', {
                          amount: formatMinorAmount(expense.totalMinor, expense.currency),
                          people: t(countKey('common.count.people.one', 'common.count.people.many', expense.participantCount), { count: expense.participantCount }),
                        })}
                        {payerNames ? ` · ${t('friends.paidBy', { names: payerNames })}` : ''}
                      </p>
                      <p className="mt-2 text-xs text-[var(--ms-text-muted)]">
                        {t('friends.visibilityHelp')}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--ms-info-bg)] px-2 py-1 text-xs font-bold text-[var(--ms-info)]">{t('common.pending')}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button className="ms-btn-ghost" disabled={action === expense.id} onClick={() => void respond(expense.id, 'declined')}>{t('common.decline')}</button>
                    <button className="ms-btn-primary" disabled={action === expense.id} onClick={() => void respond(expense.id, 'accepted')}>{t('friends.acceptShare')}</button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {incomingLinkRequests.length > 0 ? (
        <section className="mx-auto mt-6 max-w-4xl">
          <p className="ms-label">{t('friends.historyRequest')}</p>
          <div className="mt-2 grid gap-3">
            {incomingLinkRequests.map((request) => (
              <article key={request.id} className="ms-card-hero">
                <p className="font-extrabold">{t('friends.linkRequestTitle')}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--ms-text-muted)]">
                  {t('friends.linkRequestHelp')}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button className="ms-btn-ghost" disabled={action === `link:${request.id}`} onClick={() => void respondManualLink(request.id, 'declined')}>{t('common.decline')}</button>
                  <button className="ms-btn-primary" disabled={action === `link:${request.id}`} onClick={() => void respondManualLink(request.id, 'accepted')}>{t('friends.acceptLink')}</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ms-card-hero mx-auto mt-6 max-w-4xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <p className="ms-label">{t('friends.secureInvite')}</p>
            <h2 className="mt-1 text-xl font-extrabold">{t('friends.addAccount')}</h2>
            <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">{t('friends.inviteHelp')}</p>
          </div>
          <button className="ms-btn-primary h-11" disabled={action === 'invite'} onClick={() => void createInvite()}>
            {action === 'invite' ? t('common.creating') : t('friends.copyInvite')}
          </button>
        </div>
        {inviteUrl ? <p className="mt-3 truncate text-xs font-bold text-[var(--ms-success)]">{t('friends.inviteCopied')}</p> : null}
      </section>

      <section className="mx-auto mt-8 max-w-4xl">
        <p className="ms-label">{t('friends.accepted')}</p>
        <h2 className="mt-1 text-xl font-extrabold">{t('friends.yours')}</h2>
        {loading ? <div className="ms-card mt-3">{t('friends.loading')}</div> : people.length === 0 ? (
          <div className="ms-card mt-3 text-sm text-[var(--ms-text-muted)]">{t('friends.empty')}</div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {people.map((item) => (
              <button
                key={item.id}
                className="ms-card text-left"
                data-testid="person-card"
                onClick={() => navigate(`/person/${item.id}`)}
              >
                <article>
                  <p className="truncate font-extrabold">{item.displayName}</p>
                  <p className="mt-1 text-xs text-[var(--ms-text-muted)]">{t(personStateKey(item.state))}</p>
                </article>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto mt-8 max-w-4xl">
        <p className="ms-label">{t('friends.noAccount')}</p>
        <h2 className="mt-1 text-xl font-extrabold">{t('friends.untracked')}</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="ms-input min-w-0 flex-1"
            aria-label={t('friends.personName')}
            placeholder={t('friends.personName')}
            value={manualName}
            onChange={(event) => setManualName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void addManual()
            }}
          />
          <button className="ms-btn-ghost h-11" disabled={!manualName.trim() || action === 'manual'} onClick={() => void addManual()}>
            {action === 'manual' ? t('common.adding') : t('friends.addPerson')}
          </button>
        </div>
      </section>
    </main>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SettlementPanel from '../components/SettlementPanel'
import { useAuth } from '../hooks/useAuth'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { useUniversalQuickAdd } from '../hooks/useUniversalQuickAdd'
import type { LedgerDraftParticipant } from '../lib/compileExpense'
import {
  friendRepository,
  type FriendProfile,
  type ParticipantLinkRequest,
} from '../lib/friendRepository'
import { personRepository } from '../lib/personRepository'
import {
  isPersonDirectEligible,
  resolvePersonFinancialParticipant,
} from '../lib/personState'
import { formatMinorAmount } from '../lib/money'
import { ledgerRepository } from '../lib/ledgerRepository'
import {
  categoryKey,
  countKey,
  friendlyErrorKey,
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
  const quickAdd = useUniversalQuickAdd()
  const refreshLedger = ledger.refresh
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [archivedFriends, setArchivedFriends] = useState<FriendProfile[]>([])
  const [people, setPeople] = useState<PersonRelationship[]>([])
  const [linkRequests, setLinkRequests] = useState<ParticipantLinkRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<TranslationKey | ''>('')
  const [manualName, setManualName] = useState('')
  const [action, setAction] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [balanceFriendId, setBalanceFriendId] = useState<string | null>(null)
  const [linkTargets, setLinkTargets] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    if (!authUser?.participantId || authUser.isAnonymous) {
      setLoading(false)
      return
    }
    try {
      const [
        nextFriends,
        nextArchivedFriends,
        nextPeople,
        nextLinkRequests,
      ] = await Promise.all([
        friendRepository.listAcceptedFriends(),
        friendRepository.listArchivedFriends(),
        personRepository.listPeople(),
        friendRepository.listLinkRequests(),
        refreshLedger(),
      ])
      setFriends(nextFriends)
      setArchivedFriends(nextArchivedFriends)
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

  const manualParticipants = useMemo(() => people.flatMap((person) => {
    const participant = resolvePersonFinancialParticipant(person)
    return participant?.kind === 'manual'
      ? [{ id: participant.id, displayName: person.displayName }]
      : []
  }), [people])
  const captureParticipants = useMemo<LedgerDraftParticipant[]>(() => {
    if (!participantId) return []
    const self: LedgerDraftParticipant = {
      id: participantId,
      displayName: authUser?.displayName ?? authUser?.email ?? t('common.me'),
      kind: 'account',
    }
    return [
      self,
      ...people
        .filter(isPersonDirectEligible)
        .flatMap((person) => {
          const participant = resolvePersonFinancialParticipant(person)
          return participant ? [participant] : []
        }),
    ]
  }, [authUser, participantId, people, t])

  const pendingExpenses = useMemo(() => ledger.expenses.filter((expense) => (
    expense.scope === 'direct'
    && expense.status === 'active'
    && expense.participations.some((participation) => (
      participation.participantId === participantId && participation.state === 'pending'
    ))
  )), [ledger.expenses, participantId])
  const participantNames = useMemo<ReadonlyMap<string, string>>(() => new Map([
    ...(participantId ? [[participantId, authUser?.displayName ?? authUser?.email ?? t('common.you')] as const] : []),
    ...friends.map(({ participant }) => [participant.id, participant.displayName] as const),
    ...archivedFriends.map(({ participant }) => [participant.id, participant.displayName] as const),
  ]), [archivedFriends, authUser?.displayName, authUser?.email, friends, participantId, t])
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

  const openCapture = (selected: string[]) => {
    if (!participantId) return
    const target = captureParticipants.find(
      (participant) =>
        participant.id !== participantId
        && selected.includes(participant.id),
    )
    if (!target) {
      quickAdd.open({ entryPoint: 'person' })
      return
    }
    const targetPerson = people.find(
      (person) =>
        resolvePersonFinancialParticipant(person)?.id === target.id,
    )
    if (!targetPerson) return
    quickAdd.open({
      entryPoint: 'person',
      context: {
        ref: {
          kind: 'person',
          personId: targetPerson.id,
          participantId: target.id,
          participantIds: [
            target.id,
            ...targetPerson.manualParticipantIds.filter(
              (id) => id !== target.id,
            ),
          ],
          participantKind: target.kind,
          displayName: target.displayName,
        },
        currentParticipantId: participantId,
        availableParticipants: captureParticipants,
        defaultCurrency: authUser?.defaultCurrency ?? 'MYR',
      },
      initialValues: {
        selectedParticipantIds: selected,
      },
    })
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

  const requestManualLink = async (manualParticipantId: string) => {
    const targetParticipantId = linkTargets[manualParticipantId]
    if (!targetParticipantId || action) return
    setAction(`link:${manualParticipantId}`)
    setError('')
    try {
      const person = people.find(
        (candidate) =>
          candidate.manualParticipantIds.includes(manualParticipantId),
      )
      if (!person) throw new Error('person_relationship_not_found')
      await personRepository.requestLink(person.id, targetParticipantId)
      await refresh()
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

  const changeFriendship = async (friendshipId: string, next: 'archived' | 'blocked') => {
    if (action) return
    setAction(friendshipId)
    setError('')
    try {
      if (next === 'blocked') await friendRepository.blockFriendship(friendshipId)
      else await friendRepository.archiveFriendship(friendshipId)
      if (balanceFriendId && friends.some(({ friendship, participant }) => (
        friendship.id === friendshipId && participant.id === balanceFriendId
      ))) setBalanceFriendId(null)
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
                      <p className="font-extrabold">{expense.description ?? t(categoryKey(expense.category))}</p>
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
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="ms-label">{t('friends.accepted')}</p>
            <h2 className="mt-1 text-xl font-extrabold">{t('friends.yours')}</h2>
          </div>
          <button className="ms-btn-primary" onClick={() => openCapture([participantId])}>{t('friends.directSplit')}</button>
        </div>
        {loading ? <div className="ms-card">{t('friends.loading')}</div> : friends.length === 0 ? (
          <div className="ms-card text-sm text-[var(--ms-text-muted)]">{t('friends.empty')}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {friends.map(({ friendship, participant }) => (
              <article key={friendship.id} className="ms-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold">{participant.displayName}</p>
                    <p className="mt-1 text-xs text-[var(--ms-text-muted)]">{t('friends.acceptedFriend')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="ms-btn-ghost py-2 text-sm" onClick={() => setBalanceFriendId((current) => current === participant.id ? null : participant.id)}>{t('friends.balance')}</button>
                    <button className="ms-btn-ghost py-2 text-sm" onClick={() => openCapture([participantId, participant.id])}>{t('friends.split')}</button>
                  </div>
                </div>
                <div className="mt-3 flex gap-3 border-t border-[var(--ms-border)] pt-3">
                  <button className="text-xs font-bold text-[var(--ms-text-muted)]" disabled={action === friendship.id} onClick={() => void changeFriendship(friendship.id, 'archived')}>{t('friends.unfriend')}</button>
                  <button className="text-xs font-bold text-[var(--ms-danger)]" disabled={action === friendship.id} onClick={() => void changeFriendship(friendship.id, 'blocked')}>{t('friends.block')}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {balanceFriendId ? (
        <section className="mx-auto mt-8 max-w-4xl">
          <SettlementPanel
            context={{ scope: 'direct', participantIds: [participantId, balanceFriendId] }}
            currentParticipantId={participantId}
            participantNames={participantNames}
            expenses={ledger.expenses}
            canPropose
            showActivity
          />
        </section>
      ) : null}

      {archivedFriends.length > 0 ? (
        <section className="mx-auto mt-8 max-w-4xl">
          <p className="ms-label">{t('friends.past')}</p>
          <h2 className="mt-1 text-xl font-extrabold">{t('friends.history')}</h2>
          <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">
            {t('friends.historyHelp')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {archivedFriends.map(({ friendship, participant }) => (
              <button key={friendship.id} className="ms-btn-ghost py-2" onClick={() => setBalanceFriendId(participant.id)}>
                {participant.displayName}
              </button>
            ))}
          </div>
        </section>
      ) : null}

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
        {manualParticipants.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {manualParticipants.map((participant) => (
              <div key={participant.id} className="ms-card flex flex-col gap-2 sm:flex-row sm:items-center">
                <button className="ms-btn-ghost py-2" onClick={() => openCapture([participantId, participant.id])}>
                  {t('friends.splitWith', { name: participant.displayName })}
                </button>
                {friends.length > 0 ? (
                  <>
                    <select
                      className="ms-input h-10 min-w-0 flex-1"
                      value={linkTargets[participant.id] ?? ''}
                      onChange={(event) => setLinkTargets((current) => ({ ...current, [participant.id]: event.target.value }))}
                      aria-label={t('friends.linkAria', { name: participant.displayName })}
                    >
                      <option value="">{t('friends.linkPlaceholder')}</option>
                      {friends.map(({ participant: friend }) => <option key={friend.id} value={friend.id}>{friend.displayName}</option>)}
                    </select>
                    <button
                      className="ms-btn-ghost py-2 text-xs"
                      disabled={!linkTargets[participant.id] || action === `link:${participant.id}`}
                      onClick={() => void requestManualLink(participant.id)}
                    >
                      {t('friends.requestLink')}
                    </button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

    </main>
  )
}

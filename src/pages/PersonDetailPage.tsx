import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ActivityFeed from '../components/ActivityFeed'
import SettlementPanel from '../components/SettlementPanel'
import ExpenseActionSheet from '../components/ExpenseActionSheet'
import ExpenseChangeRequestList from '../components/ExpenseChangeRequestList'
import ExpenseHistoryList from '../components/ExpenseHistoryList'
import ExpenseRecoveryNotices from '../components/ExpenseRecoveryNotices'
import PendingExpenseRecoveryActions from '../components/PendingExpenseRecoveryActions'
import { useAuth } from '../hooks/useAuth'
import { useExpenseChanges } from '../hooks/useExpenseChanges'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { useSettlements } from '../hooks/useSettlements'
import { useUniversalQuickAdd } from '../hooks/useUniversalQuickAdd'
import type { LedgerDraftParticipant } from '../lib/compileExpense'
import {
  friendRepository,
  type FriendProfile,
} from '../lib/friendRepository'
import { personRepository } from '../lib/personRepository'
import {
  canSettleTrackedPerson,
  trackedDirectContext,
  trackedPersonDebtLines,
  trackedPersonExpenses,
  untrackedPersonExpenses,
  untrackedRecordTotals,
} from '../lib/personMoney'
import {
  isPersonDirectEligible,
  resolvePersonFinancialParticipant,
} from '../lib/personState'
import { formatMinorAmount } from '../lib/money'
import { type ConfirmedSettlement } from '../lib/relationalBalance'
import {
  categoryKey,
  friendlyErrorKey,
  personStateKey,
  useT,
  type TranslationKey,
} from '../lib/i18n'
import { formatDate } from '../lib/locale'
import { useStore } from '../store/useStore'
import type { PersonRelationship } from '../types'

export default function PersonDetailPage() {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const { personId = '' } = useParams()
  const navigate = useNavigate()
  const { authUser, loading: authLoading } = useAuth()
  const participantId = authUser?.participantId ?? null
  const ledger = usePersonalLedger()
  const changeState = useExpenseChanges(Boolean(participantId), ledger.refresh)
  const quickAdd = useUniversalQuickAdd()
  const refreshLedger = ledger.refresh
  const settlementState = useSettlements(Boolean(participantId))
  const [person, setPerson] = useState<PersonRelationship | null>(null)
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [archivedFriends, setArchivedFriends] = useState<FriendProfile[]>([])
  const [people, setPeople] = useState<PersonRelationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<TranslationKey | ''>('')
  const [action, setAction] = useState('')
  const [linkTarget, setLinkTarget] = useState('')
  const [settleOpen, setSettleOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (!authUser?.participantId || authUser.isAnonymous || !personId) {
      setLoading(false)
      return
    }
    try {
      const [nextPeople, nextFriends, nextArchived] = await Promise.all([
        personRepository.listPeople(),
        friendRepository.listAcceptedFriends(),
        friendRepository.listArchivedFriends(),
        refreshLedger(),
      ])
      setPeople(nextPeople)
      setFriends(nextFriends)
      setArchivedFriends(nextArchived)
      setPerson(nextPeople.find((item) => item.id === personId) ?? null)
      setError('')
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setLoading(false)
    }
  }, [authUser?.isAnonymous, authUser?.participantId, personId, refreshLedger])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(
    () => personRepository.subscribeToPeople(() => void refresh()),
    [refresh],
  )

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
        .flatMap((item) => {
          const resolved = resolvePersonFinancialParticipant(item)
          return resolved ? [resolved] : []
        }),
    ]
  }, [authUser, participantId, people, t])

  const participantNames = useMemo(() => new Map([
    ...(participantId
      ? [[participantId, authUser?.displayName ?? authUser?.email ?? t('common.you')] as const]
      : []),
    ...friends.map(({ participant }) => [participant.id, participant.displayName] as const),
    ...archivedFriends.map(({ participant }) => [participant.id, participant.displayName] as const),
    ...(person
      ? [[
        resolvePersonFinancialParticipant(person)?.id ?? person.id,
        person.displayName,
      ] as const]
      : []),
  ]), [archivedFriends, authUser, friends, participantId, person, t])

  const trackedExpenses = useMemo(
    () => person && participantId
      ? trackedPersonExpenses(ledger.expenses, participantId, person)
      : [],
    [ledger.expenses, participantId, person],
  )
  const untrackedExpenses = useMemo(
    () => person && participantId
      ? untrackedPersonExpenses(ledger.expenses, participantId, person)
      : [],
    [ledger.expenses, participantId, person],
  )
  const personHistoryExpenses = useMemo(() => {
    if (!person || !participantId) return []
    const relatedParticipantIds = new Set([
      ...person.manualParticipantIds,
      ...(person.linkedParticipantId ? [person.linkedParticipantId] : []),
    ])
    return ledger.expenses.filter((expense) => (
      expense.scope === 'direct'
      && expense.participations.some((item) => item.participantId === participantId)
      && expense.participations.some((item) => relatedParticipantIds.has(item.participantId))
    ))
  }, [ledger.expenses, participantId, person])
  const untrackedTotals = useMemo(
    () => person ? untrackedRecordTotals(untrackedExpenses, person) : [],
    [person, untrackedExpenses],
  )
  const settleContext = person && participantId
    ? trackedDirectContext(participantId, person)
    : null
  const contextSettlements = useMemo(
    () => settlementState.settlements.filter((settlement) => (
      settlement.scope === 'direct'
      && settleContext
      && settleContext.participantIds.includes(settlement.debtorParticipantId)
      && settlement.allocations.some((allocation) =>
        settleContext.participantIds.includes(allocation.creditorParticipantId),
      )
    )),
    [settleContext, settlementState.settlements],
  )
  const trackedLines = useMemo(
    () => person && participantId
      ? trackedPersonDebtLines(
        ledger.expenses,
        contextSettlements as ConfirmedSettlement[],
        participantId,
        person,
      )
      : [],
    [contextSettlements, ledger.expenses, participantId, person],
  )
  const remainingTracked = trackedLines.filter((line) => line.remainingMinor > 0)
  const canSettle = Boolean(person && canSettleTrackedPerson(person))
  const canAdd = Boolean(person && isPersonDirectEligible(person))
  const friendship = person?.linkedParticipantId
    ? [...friends, ...archivedFriends].find(
      ({ participant }) => participant.id === person.linkedParticipantId,
    )
    : undefined

  const openCapture = () => {
    if (!participantId || !person) return
    const target = resolvePersonFinancialParticipant(person)
    if (!target || !isPersonDirectEligible(person)) return
    void quickAdd.open({
      entryPoint: 'person',
      context: {
        ref: {
          kind: 'person',
          personId: person.id,
          participantId: target.id,
          participantIds: [
            target.id,
            ...person.manualParticipantIds.filter((id) => id !== target.id),
          ],
          participantKind: target.kind,
          displayName: person.displayName,
        },
        currentParticipantId: participantId,
        availableParticipants: captureParticipants,
        defaultCurrency: authUser?.defaultCurrency ?? 'MYR',
      },
      initialValues: {
        selectedParticipantIds: [participantId, target.id],
      },
      onSaved: () => refresh(),
    })
  }

  const requestManualLink = async () => {
    if (!person || !linkTarget || action) return
    setAction('link')
    setError('')
    try {
      await personRepository.requestLink(person.id, linkTarget)
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  const changeFriendship = async (next: 'archived' | 'blocked') => {
    if (!friendship || action) return
    setAction(friendship.friendship.id)
    setError('')
    try {
      if (next === 'blocked') await friendRepository.blockFriendship(friendship.friendship.id)
      else await friendRepository.archiveFriendship(friendship.friendship.id)
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  if (authLoading || loading) {
    return <main className="ms-page flex min-h-dvh items-center justify-center">{t('person.opening')}</main>
  }

  if (!authUser || authUser.isAnonymous || !participantId || !person) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <section className="ms-card-hero w-full max-w-md text-center">
          <p className="ms-label">{t('friends.title')}</p>
          <h1 className="mt-2 text-2xl font-extrabold">{t('person.notFound')}</h1>
          <button className="ms-btn-primary mt-5 w-full" onClick={() => navigate('/friends')}>
            {t('person.back')}
          </button>
        </section>
      </main>
    )
  }

  const trackedSummary = remainingTracked.length === 0
    ? canSettle
      ? t('person.settledUp')
      : t('person.noConfirmedBalance')
    : remainingTracked.map((line) => {
      const mine = line.debtorParticipantId === participantId
      const amount = formatMinorAmount(line.remainingMinor, line.currency)
      return mine
        ? `${t('settlement.youOwe', { name: person.displayName })} ${amount}`
        : t('person.theyOweYou', { name: person.displayName, amount })
    }).join(' · ')

  return (
    <main className="ms-page pb-28">
      <header className="mx-auto max-w-4xl">
        <button className="mb-4 text-sm font-bold text-[var(--ms-text-secondary)]" onClick={() => navigate('/friends')}>
          ← {t('person.back')}
        </button>
        <p className="ms-label">{t(personStateKey(person.state))}</p>
        <h1 className="mt-1 text-3xl font-extrabold">{person.displayName}</h1>
      </header>

      <ExpenseRecoveryNotices />

      {error ? (
        <p className="mx-auto mt-4 max-w-4xl rounded-xl bg-[var(--ms-danger-bg)] px-4 py-3 text-sm text-[var(--ms-danger)]">
          {t(error)}
        </p>
      ) : null}

      <section className="mx-auto mt-6 max-w-4xl" data-testid="person-position">
        <p className="ms-label">{t('person.currentBalance')}</p>
        <p className="mt-2 text-2xl font-extrabold">{trackedSummary}</p>
        {untrackedTotals.length > 0 ? (
          <div className="mt-3 text-sm text-[var(--ms-text-secondary)]">
            <p className="font-bold">{t('person.onYourRecords')}</p>
            {untrackedTotals.map((total) => (
              <p key={total.currency} className="mt-1">
                {t('person.untrackedAmount', {
                  amount: formatMinorAmount(total.totalMinor, total.currency),
                })}
              </p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mx-auto mt-6 grid max-w-4xl grid-cols-2 gap-3">
        <button className="ms-btn-primary" disabled={!canAdd} onClick={openCapture}>
          {t('person.addExpense')}
        </button>
        <button
          className="ms-btn-ghost"
          disabled={!canSettle}
          aria-disabled={!canSettle}
          title={!canSettle ? t('person.settleUpAfterLink') : undefined}
          onClick={() => {
            if (canSettle) setSettleOpen(true)
          }}
        >
          {t('person.settleUp')}
        </button>
        {!canSettle ? (
          <p className="col-span-2 text-xs text-[var(--ms-text-muted)]">{t('person.settleUpAfterLink')}</p>
        ) : null}
      </section>

      {settleOpen && settleContext ? (
        <section className="mx-auto mt-6 max-w-4xl" data-testid="person-settle">
          <SettlementPanel
            context={settleContext}
            currentParticipantId={participantId}
            participantNames={participantNames}
            expenses={ledger.expenses}
            canPropose
          />
        </section>
      ) : null}

      <section className="mx-auto mt-8 max-w-4xl" data-testid="person-expense-changes">
        <ExpenseChangeRequestList
          requests={changeState.requests}
          expenses={ledger.expenses}
          currentParticipantId={participantId}
          onRefresh={changeState.refreshAuthoritative}
          include={(request) => (
            trackedExpenses.some((expense) => expense.id === request.targetExpenseId)
            || untrackedExpenses.some((expense) => expense.id === request.targetExpenseId)
          )}
        />
      </section>

      <section className="mx-auto mt-8 max-w-4xl" data-testid="person-recent">
        <p className="ms-label">{t('person.recent')}</p>
        <h2 className="mt-1 text-xl font-extrabold">{t('person.recent')}</h2>
        <div className="ms-list mt-3">
          {trackedExpenses.length === 0 ? (
            <p className="p-5 text-center text-sm text-[var(--ms-text-muted)]">{t('person.emptyActivity')}</p>
          ) : trackedExpenses.map((item, index) => {
            const pending = ledger.outbox.find(
              (entry) => entry.command.requestId === item.clientRequestId,
            )
            const syncedPendingRequest = !pending && item.participations.some(
              (participation) => (
                participation.trackingMode === 'tracked'
                && participation.state === 'pending'
              ),
            )
            return (
            <div key={item.id}>
              {index > 0 ? <hr className="ms-divider" /> : null}
              <article className="ms-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{item.description ?? t(categoryKey(item.category))}</p>
                  {syncedPendingRequest ? (
                    <p className="mt-1 text-[10px] font-bold text-[var(--ms-accent)]">
                      {t('ledger.syncedPendingRequest')}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-[var(--ms-text-muted)]">{formatDate(item.occurredOn, lang)}</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold">{formatMinorAmount(item.totalMinor, item.currency)}</p>
                  {pending ? (
                    <PendingExpenseRecoveryActions
                      item={pending}
                      onUndoAdd={ledger.discardLocalCreate}
                      onRetry={ledger.retryCommand}
                      onDiscardFailed={ledger.discardFailedCreate}
                    />
                  ) : !changeState.loading && !changeState.error ? (
                    <div className="mt-2 flex justify-end">
                      <ExpenseActionSheet
                        expense={item}
                        currentParticipantId={participantId}
                        pendingRequest={changeState.requests.find((request) => (
                          request.targetExpenseId === item.id && request.state === 'pending'
                        ))}
                        onCancelExpense={ledger.voidExpense}
                        onRefresh={changeState.refreshAuthoritative}
                      />
                    </div>
                  ) : null}
                </div>
              </article>
            </div>
            )
          })}
        </div>
      </section>

      {untrackedExpenses.length > 0 ? (
        <section className="mx-auto mt-8 max-w-4xl" data-testid="person-untracked">
          <p className="ms-label">{t('person.onYourRecords')}</p>
          <h2 className="mt-1 text-xl font-extrabold">{t('person.earlier')}</h2>
          <div className="ms-list mt-3">
            {untrackedExpenses.map((item, index) => {
              const pending = ledger.outbox.find(
                (entry) => entry.command.requestId === item.clientRequestId,
              )
              const syncedPendingRequest = !pending && item.participations.some(
                (participation) => (
                  participation.trackingMode === 'tracked'
                  && participation.state === 'pending'
                ),
              )
              return (
              <div key={item.id}>
                {index > 0 ? <hr className="ms-divider" /> : null}
                <article className="ms-row">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{item.description ?? t(categoryKey(item.category))}</p>
                    {syncedPendingRequest ? (
                      <p className="mt-1 text-[10px] font-bold text-[var(--ms-accent)]">
                        {t('ledger.syncedPendingRequest')}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
                      {formatDate(item.occurredOn, lang)} · {t('person.untrackedBadge')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold">{formatMinorAmount(item.totalMinor, item.currency)}</p>
                    {pending ? (
                      <PendingExpenseRecoveryActions
                        item={pending}
                        onUndoAdd={ledger.discardLocalCreate}
                        onRetry={ledger.retryCommand}
                        onDiscardFailed={ledger.discardFailedCreate}
                      />
                    ) : !changeState.loading && !changeState.error ? (
                      <div className="mt-2 flex justify-end">
                        <ExpenseActionSheet
                          expense={item}
                          currentParticipantId={participantId}
                          pendingRequest={changeState.requests.find((request) => (
                            request.targetExpenseId === item.id && request.state === 'pending'
                          ))}
                          onCancelExpense={ledger.voidExpense}
                          onRefresh={changeState.refreshAuthoritative}
                        />
                      </div>
                    ) : null}
                  </div>
                </article>
              </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <div className="mx-auto mt-8 max-w-4xl">
        <ExpenseHistoryList
          expenses={personHistoryExpenses}
          directRequests={changeState.requests}
        />
      </div>

      <div className="mx-auto mt-8 max-w-4xl">
        <ActivityFeed
          expenseIds={personHistoryExpenses.map((expense) => expense.id)}
          settlementIds={contextSettlements.map((settlement) => settlement.id)}
          refreshKey={[
            ...personHistoryExpenses.map((expense) => expense.updatedAt),
            ...contextSettlements.map((settlement) => settlement.updatedAt),
          ].join('|')}
        />
      </div>

      <section className="mx-auto mt-8 max-w-4xl" data-testid="person-manage">
        <p className="ms-label">{t('person.manage')}</p>
        <h2 className="mt-1 text-xl font-extrabold">{t('person.manage')}</h2>
        <div className="ms-card mt-3">
          <p className="text-sm text-[var(--ms-text-secondary)]">{t('person.relationship')}</p>
          <p className="mt-1 font-extrabold">{t(personStateKey(person.state))}</p>
          {person.state !== 'linked' && friends.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <select
                className="ms-input h-10 min-w-0 flex-1"
                value={linkTarget}
                onChange={(event) => setLinkTarget(event.target.value)}
                aria-label={t('friends.linkAria', { name: person.displayName })}
              >
                <option value="">{t('friends.linkPlaceholder')}</option>
                {friends.map(({ participant: friend }) => (
                  <option key={friend.id} value={friend.id}>{friend.displayName}</option>
                ))}
              </select>
              <button
                className="ms-btn-ghost py-2"
                disabled={!linkTarget || action === 'link'}
                onClick={() => void requestManualLink()}
              >
                {t('friends.requestLink')}
              </button>
            </div>
          ) : null}
          {friendship && friendship.friendship.status === 'accepted' ? (
            <div className="mt-4 flex gap-3 border-t border-[var(--ms-border)] pt-3">
              <button
                className="text-xs font-bold text-[var(--ms-text-muted)]"
                disabled={action === friendship.friendship.id}
                onClick={() => void changeFriendship('archived')}
              >
                {t('friends.unfriend')}
              </button>
              <button
                className="text-xs font-bold text-[var(--ms-danger)]"
                disabled={action === friendship.friendship.id}
                onClick={() => void changeFriendship('blocked')}
              >
                {t('friends.block')}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

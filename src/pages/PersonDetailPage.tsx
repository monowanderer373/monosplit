import SharedRestartActions from '../components/SharedRestartActions'
import {visibleSharedExpense} from '../lib/sharedRestart'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BackControl,
  CenteredDialog,
  CompactBalanceCard,
  Disclosure,
  PersonHeading,
  QuietAction,
  SharedRoot,
} from '../components/shared/SharedComponents'
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
import { collectPayService } from '../lib/collectPayRepository'
import { buildCollectPayItems, type CollectPayItem } from '../lib/collectPay'
import {
  canSettleTrackedPerson,
  trackedDirectContext,
  trackedPersonDebtLines,
  trackedPersonExpenses,
  untrackedPersonExpenses,
  untrackedRecordTotals,
} from '../lib/personMoney'
import { collectionActionCopy, resolvePersonCollectPay } from '../lib/sharedAListModel'
import { financialActionsEnabled, safeLocalReturn } from '../lib/sharedAPresentation'
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
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const hidden = useStore((state) => state.homeUi.balanceHidden)
  const [collectItems, setCollectItems] = useState<CollectPayItem[]>([])
  const [loadedCollectRevision, setLoadedCollectRevision] = useState<string | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [moreOpen, setMoreOpen] = useState(false)
  const [chooseItems, setChooseItems] = useState<CollectPayItem[]>([])
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

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  const collectAuthority = `${participantId ?? ''}:${ledger.expenses.map((item) => `${item.id}:${item.version}:${item.updatedAt}:${JSON.stringify(item.sharedRestart??null)}`).join('|')}:${settlementState.settlements.map((item) => `${item.id}:${item.version}:${item.updatedAt}:${JSON.stringify(item.sharedRestart??null)}`).join('|')}`

  useEffect(() => {
    if (!participantId || authUser?.isAnonymous) {
      setCollectItems([])
      setLoadedCollectRevision(null)
      return
    }
    const token = collectAuthority
    setLoadedCollectRevision(null)
    let cancelled = false
    void collectPayService.load(participantId).then((snapshot) => {
      if (cancelled) return
      setCollectItems(buildCollectPayItems(snapshot))
      setLoadedCollectRevision(token)
    }).catch(() => {
      if (!cancelled) {
        setCollectItems([])
        setLoadedCollectRevision(null)
      }
    })
    return () => { cancelled = true }
  }, [authUser?.isAnonymous, collectAuthority, participantId])

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
      ? trackedPersonExpenses(ledger.expenses, participantId, person).filter(visibleSharedExpense)
      : [],
    [ledger.expenses, participantId, person],
  )
  const untrackedExpenses = useMemo(
    () => person && participantId
      ? untrackedPersonExpenses(ledger.expenses, participantId, person).filter(visibleSharedExpense).filter(visibleSharedExpense)
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

  const backTo = safeLocalReturn(params.get('from'))
  const selectedCurrency = (params.get('ccy') ?? authUser?.defaultCurrency ?? 'MYR').toUpperCase()
  const actionsReady = financialActionsEnabled({
    loadedRevision: loadedCollectRevision,
    currentRevision: collectAuthority,
    loading: loading || loadedCollectRevision !== collectAuthority,
    identityMatches: Boolean(participantId && person && authUser && !authUser.isAnonymous),
    online,
  })

  const openCollectPay = (direction: 'collect' | 'pay') => {
    if (!participantId || !person || !actionsReady) return
    const result = resolvePersonCollectPay({
      owner: participantId,
      personId: person.id,
      currency: selectedCurrency,
      direction,
      items: collectItems,
    })
    if (result.resolution === 'open' && result.href) {
      navigate(`${result.href}&from=${encodeURIComponent(backTo)}`)
      return
    }
    if (result.resolution === 'choose') {
      setChooseItems(result.candidates)
      return
    }
    setChooseItems([])
    setError('sharedA.unavailableCollect')
  }

  if (authLoading || loading) {
    return <SharedRoot><p role="status">{t('person.opening')}</p></SharedRoot>
  }

  if (!authUser || authUser.isAnonymous || !participantId || !person) {
    return (
      <SharedRoot>
        <BackControl label={t('sharedA.back')} onBack={() => navigate(backTo)} />
        <h1>{t('person.notFound')}</h1>
      </SharedRoot>
    )
  }

  const collectItem = collectItems.find((item) =>
    item.personId === person.id && item.direction === 'collect' && item.currency === selectedCurrency && item.context.scope === 'direct',
  )
  const payItem = collectItems.find((item) =>
    item.personId === person.id && item.direction === 'pay' && item.currency === selectedCurrency && item.context.scope === 'direct',
  )
  const theyOwe = Boolean(collectItem && collectItem.remainingMinor > 0)
  const youOwe = Boolean(payItem && payItem.remainingMinor > 0)
  const selectedLine = remainingTracked.find((line) => line.currency === selectedCurrency)
  const otherCurrency = !theyOwe && !youOwe && (
    collectItems.some((item) => item.personId === person.id && item.context.scope === 'direct' && item.remainingMinor > 0)
    || remainingTracked.some((line) => line.remainingMinor > 0 && line.currency !== selectedCurrency)
  )
  const confirmedMinor = collectItem?.remainingMinor || payItem?.remainingMinor || selectedLine?.remainingMinor || 0
  const balanceValue = hidden
    ? t('sharedA.hidden')
    : theyOwe || youOwe
      ? formatMinorAmount(confirmedMinor, selectedCurrency)
      : otherCurrency
        ? t('sharedA.otherCurrencies')
        : canSettle
          ? t('sharedA.settled')
          : t('sharedA.noRecords')
  const balanceDirection = hidden ? ''
    : selectedLine
      ? (youOwe ? t('sharedA.youOwe') : t('sharedA.owesYou'))
      : person.state === 'manual'
        ? t('sharedA.manual')
        : ''

  return (
    <>
    <SharedRoot>
      <BackControl
        label={backTo.startsWith('/friends') || backTo === '/shared' || backTo.startsWith('/shared?') ? t('person.back') : t('sharedA.back')}
        onBack={() => navigate(backTo)}
      />
      <PersonHeading
        name={person.displayName}
        context={t('sharedA.directContext', { currency: selectedCurrency })}
        moreLabel={t('sharedA.more')}
        onMore={() => setMoreOpen(true)}
      />
      {person.state === 'manual' ? <p className="ttsa-meta">{t('person.state.manual')}</p> : null}
      <QuietAction icon="down" onClick={() => {
        const options = [...new Set([authUser.defaultCurrency ?? 'MYR', ...remainingTracked.map((line) => line.currency)])]
        const index = options.indexOf(selectedCurrency)
        const next = options[(index + 1) % options.length]
        const nextParams = new URLSearchParams(params)
        nextParams.set('ccy', next)
        setParams(nextParams, { replace: true })
      }}>{selectedCurrency}</QuietAction>
      {error ? <p className="ttsa-meta" role="alert">{t(error)}</p> : null}

      <div data-testid="person-position">
        <CompactBalanceCard
          label={t('sharedA.confirmedBalance')}
          value={balanceValue}
          direction={balanceDirection}
          actions={(
            <>
              {canSettle && theyOwe ? (
                <QuietAction icon="receive" disabled={!actionsReady} onClick={() => openCollectPay('collect')}>
                  {t('sharedA.collection')}
                </QuietAction>
              ) : null}
              {canSettle && youOwe ? (
                <QuietAction icon="send" disabled={!actionsReady} onClick={() => openCollectPay('pay')}>
                  {t('sharedA.repayment')}
                </QuietAction>
              ) : null}
              <QuietAction icon="plus" disabled={!canAdd} onClick={openCapture}>{t('person.addExpense')}</QuietAction>
              {canSettle ? (
                <QuietAction icon="review" onClick={() => setSettleOpen(true)}>{t('person.settleUp')}</QuietAction>
              ) : (
                <QuietAction icon="review" disabled onClick={() => undefined}>{t('person.settleUp')}</QuietAction>
              )}
            </>
          )}
        />
        {!canSettle ? <p className="ttsa-meta">{t('person.settleUpAfterLink')}</p> : null}
        {untrackedTotals.length > 0 && !hidden ? (
          <p className="ttsa-meta">{t('person.onYourRecords')}</p>
        ) : null}
      </div>
      {collectionActionCopy(participantId, collectItem) === 'Request payment' && theyOwe ? (
        <p className="ttsa-meta">{t('sharedA.requestHelp')}</p>
      ) : null}
      {payItem ? <p className="ttsa-meta">{t('sharedA.pendingHelp')}</p> : null}
    </SharedRoot>
    <main className="ms-page pb-28">
      <ExpenseRecoveryNotices />

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
            // Completed corrections/cancellations retain their original voided target.
            personHistoryExpenses.some((expense) => expense.id === request.targetExpenseId)
          )}
        />
      </section>

      <section className="mx-auto mt-8 max-w-4xl" data-testid="person-recent">
        <p className="ms-label">{t('person.recent')}</p>
        <h2 className="mt-1 text-xl font-extrabold">{t('person.recent')}</h2>
        <div className="ms-list tt-paper-list mt-3">
          {trackedExpenses.length === 0 ? (
            <p className="p-5 text-center text-sm text-[var(--ms-text-muted)]">{t('person.emptyActivity')}</p>
          ) : trackedExpenses.filter(visibleSharedExpense).slice(0, 3).map((item, index) => {
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
              <article className="ms-row tt-record-card">
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
                  <p className="font-extrabold">{hidden ? t('sharedA.hidden') : formatMinorAmount(item.totalMinor, item.currency)}</p>
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
              <SharedRestartActions expense={item} owner={participantId} onRefresh={refresh}/>
            </div>
            )
          })}
        </div>
      </section>

      {untrackedExpenses.length > 0 ? (
        <section className="mx-auto mt-8 max-w-4xl" data-testid="person-untracked">
          <p className="ms-label">{t('person.onYourRecords')}</p>
          <h2 className="mt-1 text-xl font-extrabold">{t('person.earlier')}</h2>
          <div className="ms-list tt-paper-list mt-3">
            {untrackedExpenses.filter(visibleSharedExpense).map((item, index) => {
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
                <article className="ms-row tt-record-card">
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
                    <p className="font-extrabold">{hidden ? t('sharedA.hidden') : formatMinorAmount(item.totalMinor, item.currency)}</p>
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

      <Disclosure label={t('sharedA.details')} defaultOpen>
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
      </Disclosure>
    </main>
    <div className="tt-shared-a">
      <CenteredDialog open={moreOpen} title={t('sharedA.more')} closeLabel={t('common.close')} onClose={() => setMoreOpen(false)}>
        {canSettle ? (
          <QuietAction icon="review" onClick={() => { setMoreOpen(false); setSettleOpen(true) }}>{t('person.settleUp')}</QuietAction>
        ) : <p className="ttsa-meta">{t('person.settleUpAfterLink')}</p>}
      </CenteredDialog>
      <CenteredDialog open={chooseItems.length > 0} title={t('sharedA.chooseExact')} closeLabel={t('common.close')} onClose={() => setChooseItems([])}>
        {chooseItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className="ttsa-link-row"
            onClick={() => {
              navigate(`/collect-pay/${item.direction}?${new URLSearchParams({ item: item.key, from: backTo })}`)
              setChooseItems([])
            }}
          >
            {item.currency} · {item.source}
          </button>
        ))}
      </CenteredDialog>
    </div>
    </>
  )
}

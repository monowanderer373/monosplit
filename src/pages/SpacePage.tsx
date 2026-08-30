import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ExpenseCaptureSheet, { type CaptureParticipant } from '../components/ExpenseCaptureSheet'
import SettlementPanel from '../components/SettlementPanel'
import ActivityFeed from '../components/ActivityFeed'
import { useAuth } from '../hooks/useAuth'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { formatMinorAmount } from '../lib/money'
import { spaceRepository, type SpaceWithRole } from '../lib/spaceRepository'
import { buildTripRecap } from '../lib/insights'
import type { Participant, SpaceMember } from '../types'
import {
  categoryKey,
  countKey,
  friendlyErrorKey,
  roleKey,
  spaceTypeKey,
  useT,
  type TranslationKey,
} from '../lib/i18n'
import { formatDate } from '../lib/locale'
import { useStore } from '../store/useStore'

type MemberEntry = {
  member: SpaceMember
  participant: Participant
}

export default function SpacePage() {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const { spaceId = '' } = useParams()
  const navigate = useNavigate()
  const { authUser } = useAuth()
  const ledger = usePersonalLedger()
  const refreshLedger = ledger.refresh
  const [entry, setEntry] = useState<SpaceWithRole | null>(null)
  const [members, setMembers] = useState<MemberEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<TranslationKey | ''>('')
  const [captureStartedAt, setCaptureStartedAt] = useState<number | null>(null)
  const [inviteRole, setInviteRole] = useState<'full_access' | 'view'>('full_access')
  const [inviteUrl, setInviteUrl] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [manualName, setManualName] = useState('')
  const [memberAction, setMemberAction] = useState('')

  const refresh = useCallback(async () => {
    if (!spaceId) return
    try {
      const [space, nextMembers] = await Promise.all([
        spaceRepository.get(spaceId),
        spaceRepository.listMembers(spaceId),
        refreshLedger(),
      ])
      setEntry(space)
      setMembers(nextMembers)
      setError(space ? '' : 'space.notFound')
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setLoading(false)
    }
  }, [refreshLedger, spaceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const expenses = useMemo(
    () => ledger.expenses
      .filter((expense) => expense.spaceId === spaceId && expense.status === 'active')
      .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)),
    [ledger.expenses, spaceId],
  )
  const recap = useMemo(() => buildTripRecap(expenses), [expenses])

  const captureParticipants = useMemo<CaptureParticipant[]>(
    () => members.map(({ participant }) => ({
      id: participant.id,
      displayName: participant.displayName,
      kind: participant.kind,
    })),
    [members],
  )
  const memberNames = useMemo(
    () => new Map(members.map(({ participant }) => [participant.id, participant.displayName])),
    [members],
  )

  const copyInvite = async () => {
    if (!entry || creatingInvite) return
    setCreatingInvite(true)
    setError('')
    try {
      const token = await spaceRepository.createInvite(entry.space.id, inviteRole)
      const url = `${window.location.origin}/space-invite/${token}`
      setInviteUrl(url)
      await navigator.clipboard?.writeText(url)
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setCreatingInvite(false)
    }
  }

  const addManualMember = async () => {
    if (!manualName.trim() || !entry || memberAction) return
    setMemberAction('add')
    setError('')
    try {
      await spaceRepository.addManualMember(entry.space.id, manualName.trim())
      setManualName('')
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setMemberAction('')
    }
  }

  const updateMemberRole = async (participantId: string, role: 'full_access' | 'view') => {
    if (!entry || memberAction) return
    setMemberAction(participantId)
    setError('')
    try {
      await spaceRepository.updateMemberRole(entry.space.id, participantId, role)
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setMemberAction('')
    }
  }

  const removeMember = async (participantId: string) => {
    if (!entry || memberAction) return
    setMemberAction(participantId)
    setError('')
    try {
      await spaceRepository.removeMember(entry.space.id, participantId)
      if (participantId === authUser?.participantId) {
        navigate('/spaces', { replace: true })
        return
      }
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setMemberAction('')
    }
  }

  if (loading) {
    return <main className="ms-page flex min-h-dvh items-center justify-center">{t('space.opening')}</main>
  }

  if (!entry || !authUser?.participantId) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <section className="ms-card-hero w-full max-w-md text-center">
          <p className="ms-label">{t('space.shared')}</p>
          <h1 className="mt-2 text-2xl font-extrabold">{t('space.unavailable')}</h1>
          <p className="mt-3 text-sm text-[var(--ms-text-secondary)]">{error ? t(error) : t('space.unavailableHelp')}</p>
          <button className="ms-btn-primary mt-5 w-full" onClick={() => navigate('/spaces')}>{t('space.back')}</button>
        </section>
      </main>
    )
  }

  const canWrite = entry.role === 'owner' || entry.role === 'full_access'

  return (
    <main className="ms-page pb-28">
      <header className="mx-auto max-w-4xl">
        <button className="mb-4 text-sm font-bold text-[var(--ms-text-secondary)]" onClick={() => navigate('/spaces')}>← {t('common.spaces')}</button>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="ms-label">{t(spaceTypeKey(entry.space.type))} · {t(roleKey(entry.role))}</p>
            <h1 className="mt-1 text-3xl font-extrabold">{entry.space.name}</h1>
            <p className="mt-2 text-sm text-[var(--ms-text-secondary)]">
              {entry.space.defaultCurrency} · {t(countKey('common.count.member.one', 'common.count.member.many', members.length), { count: members.length })}
            </p>
          </div>
          {canWrite ? (
            <button className="ms-btn-primary h-11" onClick={() => setCaptureStartedAt(Date.now())}>{t('space.addExpense')}</button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="mx-auto mt-4 max-w-4xl rounded-xl bg-[var(--ms-danger-bg)] px-4 py-3 text-sm text-[var(--ms-danger)]">
          {t(error)}
        </p>
      ) : null}

      <section className="mx-auto mt-6 max-w-4xl">
        <div className="ms-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="ms-label">{t('space.people')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {members.map(({ member, participant }) => (
                  <div key={participant.id} className="flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--ms-bg-warm)] px-3 py-1.5 text-sm">
                    <span className="font-bold">
                      {participant.id === authUser.participantId ? t('common.you') : participant.displayName}
                      {member.role === 'owner' ? ` · ${t('role.owner')}` : ''}
                      {participant.kind === 'manual' ? ` · ${t('space.untracked')}` : ''}
                    </span>
                    {entry.role === 'owner' && member.role !== 'owner' && participant.kind === 'account' ? (
                      <select
                        className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-surface)] px-2 py-1 text-xs"
                        value={member.role}
                        disabled={memberAction === participant.id}
                        aria-label={t('space.accessFor', { name: participant.displayName })}
                        onChange={(event) => void updateMemberRole(participant.id, event.target.value as 'full_access' | 'view')}
                      >
                        <option value="full_access">{t('role.full_access')}</option>
                        <option value="view">{t('role.view')}</option>
                      </select>
                    ) : null}
                    {member.role !== 'owner' && (
                      entry.role === 'owner' || participant.id === authUser.participantId
                    ) ? (
                      <button
                        className="min-h-9 px-1 text-xs font-bold text-[var(--ms-danger)]"
                        disabled={memberAction === participant.id}
                        aria-label={participant.id === authUser.participantId
                          ? t('common.leave')
                          : t('space.removeMember', { name: participant.displayName })}
                        onClick={() => void removeMember(participant.id)}
                      >
                        {participant.id === authUser.participantId ? t('common.leave') : t('common.remove')}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {canWrite ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-[var(--ms-border)] pt-4 sm:flex-row">
              <input
                className="ms-input min-w-0 flex-1"
                aria-label={t('space.addPersonPlaceholder')}
                placeholder={t('space.addPersonPlaceholder')}
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void addManualMember()
                }}
              />
              <button className="ms-btn-ghost h-11" disabled={!manualName.trim() || memberAction === 'add'} onClick={() => void addManualMember()}>
                {memberAction === 'add' ? t('common.adding') : t('space.addUntracked')}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {entry.role === 'owner' ? (
        <section className="mx-auto mt-4 max-w-4xl">
          <div className="ms-card flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
              {t('space.inviteAccess')}
              <select className="ms-input mt-1 w-full sm:w-44" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'full_access' | 'view')}>
                <option value="full_access">{t('space.inviteWrite')}</option>
                <option value="view">{t('role.view')}</option>
              </select>
            </label>
            <button className="ms-btn-ghost h-11" disabled={creatingInvite} onClick={() => void copyInvite()}>
              {creatingInvite ? t('common.creating') : t('space.copyInvite')}
            </button>
            {inviteUrl ? <p className="min-w-0 flex-1 truncate text-xs text-[var(--ms-success)]">{t('space.inviteCopied')}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="mx-auto mt-8 max-w-4xl">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="ms-label">{t('common.ledger')}</p>
            <h2 className="mt-1 text-xl font-extrabold">{t('space.expenses')}</h2>
          </div>
          <button className="ms-btn-ghost py-2 text-sm" onClick={() => void refresh()}>{t('common.refresh')}</button>
        </div>

        <div className="ms-list">
          {expenses.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-4xl">🧾</p>
              <h3 className="mt-3 font-extrabold">{t('space.emptyTitle')}</h3>
              <p className="mt-1 text-sm text-[var(--ms-text-muted)]">{t('space.emptyHelp')}</p>
            </div>
          ) : expenses.map((expense, index) => {
            const payerIds = new Set(expense.payerContributions.map((item) => (
              expense.participations.find((participation) => participation.id === item.expenseParticipationId)?.participantId
            )))
            const myParticipation = expense.participations.find((participation) => participation.participantId === authUser.participantId)
            const myShare = expense.shares.find((share) => share.expenseParticipationId === myParticipation?.id)?.amountMinor ?? 0
            const canVoid = entry.role === 'owner' || expense.createdBy === authUser.participantId
            const pending = ledger.outbox.find(
              (item) => item.command.requestId === expense.clientRequestId,
            )
            return (
              <div key={expense.id}>
                {index > 0 ? <hr className="ms-divider" /> : null}
                <article className="ms-row items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-extrabold">{expense.description ?? t(categoryKey(expense.category))}</p>
                      {pending ? (
                        <span className="rounded-full bg-[var(--ms-info-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--ms-info)]">
                          {pending.status === 'rejected' ? t('ledger.needsAttention') : t('ledger.pendingSync')}
                        </span>
                      ) : null}
                      {pending?.status === 'rejected' ? (
                        <button
                          className="min-h-9 px-2 text-xs font-extrabold text-[var(--ms-accent)]"
                          onClick={() => void ledger.retryCommand(pending.command.requestId)}
                        >
                          {t('common.retry')}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
                      {t('space.paidBy', {
                        date: formatDate(expense.occurredOn, lang),
                        names: [...payerIds].filter(Boolean).map((id) => (
                          id === authUser.participantId ? t('common.you') : memberNames.get(id as string) ?? t('common.member')
                        )).join(', '),
                      })}
                    </p>
                    <p className="mt-1 text-xs text-[var(--ms-text-secondary)]">
                      {t('space.yourShare', { amount: formatMinorAmount(myShare, expense.currency) })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold">{formatMinorAmount(expense.totalMinor, expense.currency)}</p>
                    {canVoid ? (
                      <button className="mt-2 text-xs font-bold text-[var(--ms-danger)]" onClick={() => void ledger.voidExpense(expense.id)}>
                        {t('space.void')}
                      </button>
                    ) : null}
                  </div>
                </article>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-4xl">
        <p className="ms-label">{entry.space.type === 'trip' ? t('space.tripRecap') : t('space.insights')}</p>
        <h2 className="mt-1 text-xl font-extrabold">{t('space.totalsCurrency')}</h2>
        {recap.currencies.length === 0 ? (
          <div className="ms-card mt-3 text-sm text-[var(--ms-text-muted)]">{t('space.insightsEmpty')}</div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {recap.currencies.map((currency) => (
              <article key={currency.currency} className="ms-card">
                <p className="ms-label">{currency.currency}</p>
                <p className="mt-2 text-2xl font-extrabold">{formatMinorAmount(currency.totalMinor, currency.currency)}</p>
                <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
                  {t(countKey('common.count.expense.one', 'common.count.expense.many', currency.expenseCount), { count: currency.expenseCount })}
                </p>
                <div className="mt-3 space-y-1">
                  {currency.categories.slice(0, 3).map((category) => (
                    <div key={category.category} className="flex justify-between gap-3 text-xs">
                      <span>{t(categoryKey(category.category))}</span>
                      <span className="font-bold">{formatMinorAmount(category.totalMinor, currency.currency)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto mt-8 max-w-4xl">
        <SettlementPanel
          context={{ scope: 'space', spaceId: entry.space.id }}
          currentParticipantId={authUser.participantId}
          participantNames={memberNames}
          expenses={expenses}
          canPropose={canWrite}
        />
      </section>

      <section className="mx-auto mt-8 max-w-4xl">
        <ActivityFeed spaceId={entry.space.id} expenseIds={expenses.map((expense) => expense.id)} />
      </section>

      {captureStartedAt != null ? (
        <ExpenseCaptureSheet
          scope="space"
          spaceId={entry.space.id}
          contextLabel={entry.space.name}
          currentParticipantId={authUser.participantId}
          participants={captureParticipants}
          defaultCurrency={entry.space.defaultCurrency}
          startedAtMs={captureStartedAt}
          onClose={() => setCaptureStartedAt(null)}
          onSave={ledger.saveDraft}
        />
      ) : null}
    </main>
  )
}

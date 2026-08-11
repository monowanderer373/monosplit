import { useMemo, useState } from 'react'
import { getCurrencySymbol } from '../lib/currency'
import { formatMoney } from '../lib/format'
import { canEditOwnPaymentInfo } from '../lib/permissions'
import { useT } from '../lib/i18n'
import { getPersonNameStyle } from '../lib/personTheme'
import { createGroupSettlementSnapshot, getCounterpartyBalances } from '../lib/settlementLedger'
import type { Group, GroupRole, PaymentInfo } from '../types'

type Props = {
  group: Group
  authUserId?: string
  role: GroupRole | null
  onUpdatePersonPaymentInfo: (personId: string, updates: Partial<PaymentInfo>) => void
  onAddComment: (personId: string, message: string) => void
  onAddExpense?: () => void
  onViewSettle?: () => void
  canAddExpense?: boolean
}

export default function DashboardTab({
  group,
  authUserId,
  role,
  onUpdatePersonPaymentInfo,
  onAddComment,
  onAddExpense,
  onViewSettle,
  canAddExpense = true,
}: Props) {
  const t = useT()

  // Resolve the logged-in user's person in this group
  const myPerson = useMemo(
    () => authUserId ? group.people.find((p) => p.authUserId === authUserId) ?? null : null,
    [authUserId, group.people],
  )
  const snapshot = useMemo(() => createGroupSettlementSnapshot(group), [group])
  const settlementCurrencies = useMemo(
    () => Array.from(new Set(snapshot.settlements.map((settlement) => settlement.currency))).sort(),
    [snapshot.settlements],
  )
  const myBalances = useMemo(() => {
    if (!myPerson) return []
    return settlementCurrencies.flatMap((currency) =>
      getCounterpartyBalances(snapshot, myPerson.id, currency).map((balance) => {
        const oweAmount = Math.max(0, balance.directAmount - balance.reverseAmount)
        const owedAmount = Math.max(0, balance.reverseAmount - balance.directAmount)
        return {
          personId: balance.creditorId,
          currency,
          oweAmount,
          owedAmount,
        }
      }),
    ).filter((row) => row.oweAmount > 0.001 || row.owedAmount > 0.001)
  }, [myPerson, settlementCurrencies, snapshot])
  const myOweRows = useMemo(
    () => myBalances.filter((row) => row.oweAmount > 0.001).sort((a, b) => b.oweAmount - a.oweAmount),
    [myBalances],
  )
  const myOwedRows = useMemo(
    () => myBalances.filter((row) => row.owedAmount > 0.001).sort((a, b) => b.owedAmount - a.owedAmount),
    [myBalances],
  )
  const totalOweByCurrency = useMemo(() => {
    const totals: Record<string, number> = {}
    myOweRows.forEach((row) => {
      totals[row.currency] = (totals[row.currency] || 0) + row.oweAmount
    })
    return totals
  }, [myOweRows])
  const totalOwedByCurrency = useMemo(() => {
    const totals: Record<string, number> = {}
    myOwedRows.forEach((row) => {
      totals[row.currency] = (totals[row.currency] || 0) + row.owedAmount
    })
    return totals
  }, [myOwedRows])
  const recentExpenses = useMemo(
    () =>
      group.expenses
        .slice()
        .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
        .slice(0, 4),
    [group.expenses],
  )

  const defaultPersonId = myPerson?.id ?? group.people[0]?.id ?? ''
  const [selectedPersonId, setSelectedPersonId] = useState(defaultPersonId)
  const [commentInput, setCommentInput] = useState('')
  const [paymentEditing, setPaymentEditing] = useState(false)
  const [paymentDraftByPersonId, setPaymentDraftByPersonId] = useState<
    Record<string, { bankName: string; accountHolder: string; accountNumber: string }>
  >({})

  // Comment identity: always the logged-in user's person if known
  const commentPersonId = myPerson?.id ?? ''
  const commentPerson = group.people.find((person) => person.id === commentPersonId)
  const canEditSelectedPaymentInfo =
    canEditOwnPaymentInfo(role) &&
    !!selectedPersonId &&
    !!myPerson &&
    selectedPersonId === myPerson.id

  const selectedPerson = group.people.find((person) => person.id === selectedPersonId)
  const paymentInfo = selectedPerson?.paymentInfo ?? {
    qrCodeDataUrl: null,
    bankName: '',
    accountHolder: '',
    accountNumber: '',
  }
  const paymentDraft = paymentDraftByPersonId[selectedPersonId] ?? {
    bankName: paymentInfo.bankName,
    accountHolder: paymentInfo.accountHolder,
    accountNumber: paymentInfo.accountNumber,
  }

  const comments = useMemo(
    () => [...(group.comments || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [group.comments],
  )

  if (group.people.length === 0) {
    return (
      <section className="space-y-4 pb-24">
        <div className="ms-card-soft text-sm text-[#6b6058]">{t('dash.addFirst')}</div>
      </section>
    )
  }

  return (
    <section className="space-y-4 pb-24 lg:pb-0">
      <div className="ms-card-soft overflow-hidden">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ms-text-muted)]">
              {t('dash.myMoneyStatus')}
            </p>
            <h2 className="mt-2 text-3xl font-black leading-tight text-[var(--ms-text)]">
              {myPerson ? `${t('dash.hi')}, ${myPerson.name}` : t('dash.tripMoneyStatus')}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-[var(--ms-text-secondary)]">
              {myPerson
                ? myOweRows.length > 0
                  ? t('dash.youHaveToSettle')
                  : myOwedRows.length > 0
                    ? t('dash.friendsNeedToPayYou')
                    : t('dash.allSettledPersonal')
                : t('dash.signInForPersonal')}
            </p>
          </div>

          <div className="grid min-w-[210px] gap-2 rounded-3xl border border-[var(--ms-border)] bg-[var(--ms-surface-dim)] p-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ms-text-muted)]">{t('dash.youOwe')}</p>
              {Object.keys(totalOweByCurrency).length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  {Object.entries(totalOweByCurrency).map(([currency, amount]) => (
                    <p key={currency} className="text-xl font-black text-[var(--ms-danger)]">
                      {getCurrencySymbol(currency)}{formatMoney(amount)}
                      <span className="ml-1 text-xs font-semibold text-[var(--ms-text-muted)]">{currency}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xl font-black text-[var(--ms-success)]">{t('dash.none')}</p>
              )}
            </div>
            <div className="h-px bg-[var(--ms-border)]" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ms-text-muted)]">{t('dash.youAreOwed')}</p>
              {Object.keys(totalOwedByCurrency).length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  {Object.entries(totalOwedByCurrency).map(([currency, amount]) => (
                    <p key={currency} className="text-lg font-black text-[var(--ms-success)]">
                      {getCurrencySymbol(currency)}{formatMoney(amount)}
                      <span className="ml-1 text-xs font-semibold text-[var(--ms-text-muted)]">{currency}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-lg font-black text-[var(--ms-text-secondary)]">{t('dash.none')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
          <div className="rounded-3xl border border-[var(--ms-border)] bg-[var(--ms-surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-[var(--ms-text)]">{t('dash.nextActions')}</h3>
              <button className="ms-btn-ghost text-xs" onClick={onViewSettle}>
                {t('dash.viewSettle')}
              </button>
            </div>

            {myPerson ? (
              <div className="space-y-2">
                {myOweRows.slice(0, 3).map((row) => {
                  const person = group.people.find((entry) => entry.id === row.personId)
                  return (
                    <div key={`owe-${row.personId}-${row.currency}`} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--ms-surface-dim)] px-3 py-2">
                      <div>
                        <p className="text-sm font-bold text-[var(--ms-text)]">{t('dash.pay')} {person?.name ?? t('dash.unknown')}</p>
                        <p className="text-xs text-[var(--ms-text-muted)]">{t('dash.toSettleYourPart')}</p>
                      </div>
                      <p className="shrink-0 text-base font-black text-[var(--ms-danger)]">
                        {getCurrencySymbol(row.currency)}{formatMoney(row.oweAmount)}
                      </p>
                    </div>
                  )
                })}
                {myOwedRows.slice(0, 2).map((row) => {
                  const person = group.people.find((entry) => entry.id === row.personId)
                  return (
                    <div key={`owed-${row.personId}-${row.currency}`} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--ms-success-bg)] px-3 py-2">
                      <div>
                        <p className="text-sm font-bold text-[var(--ms-text)]">{person?.name ?? t('dash.unknown')} {t('dash.paysYou')}</p>
                        <p className="text-xs text-[var(--ms-text-muted)]">{t('dash.waitingForPayment')}</p>
                      </div>
                      <p className="shrink-0 text-base font-black text-[var(--ms-success)]">
                        {getCurrencySymbol(row.currency)}{formatMoney(row.owedAmount)}
                      </p>
                    </div>
                  )
                })}
                {myOweRows.length === 0 && myOwedRows.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--ms-success-bg)] px-3 py-3 text-sm font-semibold text-[var(--ms-success)]">
                    {t('dash.noActionNeeded')}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl bg-[var(--ms-accent-bg)] px-3 py-3 text-sm text-[var(--ms-text-secondary)]">
                {t('dash.personalNeedsIdentity')}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--ms-border)] bg-[var(--ms-surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-[var(--ms-text)]">{t('dash.quickTripActions')}</h3>
            </div>
            <div className="grid gap-2">
              <button className="ms-btn-primary w-full" onClick={onAddExpense} disabled={!canAddExpense}>
                {t('tab.addExpense')}
              </button>
              <button className="ms-btn-ghost w-full py-2 text-sm" onClick={onViewSettle}>
                {t('dash.openFullSettlement')}
              </button>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ms-text-muted)]">{t('dash.recentExpenses')}</p>
              <div className="space-y-2">
                {recentExpenses.length === 0 ? (
                  <p className="text-sm text-[var(--ms-text-muted)]">{t('dash.noRecentExpenses')}</p>
                ) : (
                  recentExpenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-[var(--ms-text-secondary)]">{expense.description}</span>
                      <span className="shrink-0 font-bold text-[var(--ms-text)]">
                        {getCurrencySymbol(expense.paidCurrency)}{formatMoney(expense.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
      <div className="ms-card-soft">
        <h3 className="ms-title mb-2">{t('dash.title')}</h3>
        <p className="mb-3 text-xs text-[#6b6058]">{t('dash.sharedComments')}</p>

        <div className="mb-3 h-[48dvh] min-h-72 overflow-y-auto rounded-xl border border-[#d8d0c4] bg-[#faf8f4] p-3 lg:h-[56dvh]">
          {comments.length === 0 ? <p className="text-sm text-[#6b6058]">{t('dash.noComments')}</p> : null}
          {comments.map((comment) => {
            const person = group.people.find((entry) => entry.id === comment.personId)
            return (
              <div key={comment.id} className="rounded-xl border border-[#e6e0d5] bg-[#f0ece3] p-3">
                <p className="text-xs text-[#6b6058]">
                  <span style={getPersonNameStyle(person)}>{person?.name ?? t('dash.unknown')}</span> · {new Date(comment.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-[#2c2520]">{comment.message}</p>
              </div>
            )
          })}
        </div>

        {/* Posting-as identity bar */}
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#e6e0d5] bg-[#f0ece3] px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#d8d0c4] bg-[#faf8f4] text-sm font-bold text-[#3a3330]">
            {commentPerson?.avatarDataUrl ? (
              <img src={commentPerson.avatarDataUrl} alt={commentPerson.name} className="h-8 w-8 scale-[1.7] object-cover object-center" />
            ) : (
              <span style={getPersonNameStyle(commentPerson)}>{(commentPerson?.name || '?').slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <p className="text-xs text-[#6b6058]">
            Posting as{' '}
            <span className="font-semibold text-[#2c2520]">{commentPerson?.name ?? t('dash.unknown')}</span>
          </p>
          {!myPerson && (
            <p className="ml-auto text-[10px] italic text-[#9a9088]">Log in to use your identity</p>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 sm:items-center">
          <input
            className="ms-input h-12"
            placeholder={t('dash.placeholder')}
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              const msg = commentInput.trim()
              if (!msg || !commentPersonId) return
              onAddComment(commentPersonId, msg)
              setCommentInput('')
            }}
          />
          <button
            className="ms-btn-primary h-12 px-4"
            disabled={!commentPersonId}
            onClick={() => {
              const msg = commentInput.trim()
              if (!msg || !commentPersonId) return
              onAddComment(commentPersonId, msg)
              setCommentInput('')
            }}
          >
            {t('dash.post')}
          </button>
        </div>
      </div>

      <div className="ms-card-soft">
        <h2 className="ms-title mb-3">{t('dash.paymentInfo')}</h2>
        <label className="text-sm text-[#6b6058]">
          {t('dash.member')}
          <select
            className="ms-input mt-1 w-full"
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
          >
            {group.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>

        {selectedPerson ? (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
            <input
              className="ms-input"
              placeholder={t('dash.bankName')}
              value={paymentDraft.bankName}
              disabled={!paymentEditing || !canEditSelectedPaymentInfo}
              onChange={(e) =>
                setPaymentDraftByPersonId((prev) => ({
                  ...prev,
                  [selectedPerson.id]: {
                    ...paymentDraft,
                    bankName: e.target.value,
                  },
                }))
              }
            />
            <input
              className="ms-input"
              placeholder={t('dash.accountHolder')}
              value={paymentDraft.accountHolder}
              disabled={!paymentEditing || !canEditSelectedPaymentInfo}
              onChange={(e) =>
                setPaymentDraftByPersonId((prev) => ({
                  ...prev,
                  [selectedPerson.id]: {
                    ...paymentDraft,
                    accountHolder: e.target.value,
                  },
                }))
              }
            />
            <input
              className="ms-input"
              placeholder={t('dash.accountNumber')}
              value={paymentDraft.accountNumber}
              disabled={!paymentEditing || !canEditSelectedPaymentInfo}
              onChange={(e) =>
                setPaymentDraftByPersonId((prev) => ({
                  ...prev,
                  [selectedPerson.id]: {
                    ...paymentDraft,
                    accountNumber: e.target.value,
                  },
                }))
              }
            />

            <button
              className="ms-btn-primary mt-1 lg:col-span-2"
              disabled={!canEditSelectedPaymentInfo}
              onClick={() => {
                if (!canEditSelectedPaymentInfo) return
                if (!paymentEditing) {
                  setPaymentEditing(true)
                  return
                }
                onUpdatePersonPaymentInfo(selectedPerson.id, {
                  bankName: paymentDraft.bankName,
                  accountHolder: paymentDraft.accountHolder,
                  accountNumber: paymentDraft.accountNumber,
                })
                setPaymentEditing(false)
              }}
            >
              {paymentEditing ? t('people.save') : t('dash.editBtn')}
            </button>
          </div>
        ) : null}
      </div>
      </div>
    </section>
  )
}

import { capitalizeDescription } from '../lib/description'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { CanonicalExpense, GroupRole } from '../types'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import { SELECTABLE_EXPENSE_CATEGORIES } from '../lib/categories'
import { CURRENCIES } from '../lib/currency'
import { deriveExpenseActionPolicy, financialFailureDisposition, type ExpenseAction } from '../lib/expenseActionPolicy'
import { expenseChangeRepository, type DirectExpenseChangeRequest, type ExpenseFinancialPayload } from '../lib/expenseChangeRepository'
import { rescaleMinorAmounts } from '../lib/expenseFinancialDraft'
import { expenseEditSnapshot, financialEditsChanged, metadataEditsChanged, saveExpenseEdits } from '../lib/saveExpenseEdits'
import { generateId } from '../lib/id'
import { categoryKey, friendlyErrorKey, machineCode, useT, type TranslationKey } from '../lib/i18n'
import { currencyExponent, formatMinorAmount, parseMajorAmount, reconcileMinorAmounts } from '../lib/money'
import { ledgerRepository } from '../lib/ledgerRepository'
import { useStore } from '../store/useStore'
import QuickIcon from './QuickIcon'
import MoneyText from './MoneyText'
import './expense-editor.css'

type EditorMode = 'metadata' | 'financial' | 'correction' | 'space_correction' | 'cancel' | 'request_cancellation' | 'view_request'
type Props = {
  trigger?: ReactNode
  triggerClassName?: string
  contextLabel?: string
  expense: CanonicalExpense
  currentParticipantId: string
  spaceRole?: GroupRole | null
  pendingRequest?: DirectExpenseChangeRequest | null
  onCancelExpense?: (expenseId: string) => Promise<void>
  onRefresh: () => Promise<unknown>
  statusNotice?: string
}

export default function ExpenseActionSheet({
  expense, currentParticipantId, spaceRole = null, pendingRequest = null,
  onCancelExpense, onRefresh, statusNotice = '', trigger, triggerClassName, contextLabel,
}: Props) {
  const t = useT()
  const zh = useStore(state => state.lang) === 'zh'
  const copy = (en: string, cn: string) => zh ? cn : en
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [requestedMode, setMode] = useState<EditorMode>('financial')
  const [reviewPayload, setReviewPayload] = useState<ExpenseFinancialPayload | null>(null)
  const [splitOpen, setSplitOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failClosed, setFailClosed] = useState(false)
  const [error, setError] = useState<TranslationKey | ''>('')
  const [notice, setNotice] = useState('')
  const [partialSave, setPartialSave] = useState(false)
  const [description, setDescription] = useState(expense.description ?? '')
  const [category, setCategory] = useState(expense.category)
  const [occurredOn, setOccurredOn] = useState(expense.occurredOn)
  const [total, setTotal] = useState(minorInput(expense.totalMinor, expense.currency))
  const [currency, setCurrency] = useState(expense.currency)
  const [paid, setPaid] = useState<Record<string, string>>({})
  const [shares, setShares] = useState<Record<string, string>>({})
  const baseline = useRef(expenseEditSnapshot(expense))
  const draftActive = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const busy = useRef(false)
  const orderedParticipations = useMemo(() => [...expense.participations].sort((a, b) => a.order - b.order), [expense.participations])
  const policy = useMemo(() => deriveExpenseActionPolicy({ expense, currentParticipantId, spaceRole, pendingRequest }), [expense, currentParticipantId, spaceRole, pendingRequest])
  const initialMode = (): EditorMode => {
    if (policy.actions.includes('edit_financials')) return 'financial'
    if (policy.actions.includes('propose_correction')) return expense.scope === 'space' ? 'space_correction' : 'correction'
    return policy.actions.includes('edit_metadata') ? 'metadata' : 'view_request'
  }
  // Re-evaluate edit authority if a shared participant responds while open.
  const mode = requestedMode === 'cancel' || requestedMode === 'request_cancellation' ? requestedMode : initialMode()
  const mutationBlocked = failClosed || policy.mutationBlocked
    || (mode === 'cancel' && !policy.actions.includes('cancel'))
    || (mode === 'request_cancellation' && !policy.actions.includes('request_cancellation'))
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  const requestClose = () => {
    if (busy.current || closing) return
    setClosing(true)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    closeTimer.current = setTimeout(() => { setOpen(false); setClosing(false) }, reduced ? 100 : 180)
  }
  const openSheet = () => {
    if (!draftActive.current || expense.id !== baseline.current.expenseId || expense.version > baseline.current.version) {
      baseline.current = expenseEditSnapshot(expense)
      setDescription(expense.description ?? '')
      setCategory(expense.category)
      setOccurredOn(expense.occurredOn)
      setTotal(minorInput(expense.totalMinor, expense.currency))
      setCurrency(expense.currency)
      setPaid(amountInputs(expense, 'paid'))
      setShares(amountInputs(expense, 'share'))
      setPartialSave(false)
      setError('')
      setNotice('')
      setSplitOpen(false)
      draftActive.current = true
    }
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setClosing(false)
    setReviewPayload(null)
    setMode(initialMode())
    setFailClosed(false)
    setOpen(true)
  }
  if (policy.actions.length === 0) return null

  const expenseName = capitalizeDescription(expense.description ?? t(categoryKey(expense.category)))
  const editing = ['metadata', 'financial', 'correction', 'space_correction'].includes(mode)
  const shared = expense.scope !== 'personal'
  const sharedNames = orderedParticipations.filter(person => person.participantId !== currentParticipantId).map(person => person.nameSnapshot).join(', ')
  const subtitle = contextLabel ?? (shared ? copy(`Shared with ${sharedNames}`, `与 ${sharedNames} 共享`) : copy('Personal expense', '个人账目'))
  const buildPayload = (): ExpenseFinancialPayload => {
    const totalMinor = parseMajorAmount(total, currency)
    const participantIds = orderedParticipations.map(person => person.participantId)
    const contributionAmounts = participantIds.map(id => parseNonnegativeMajor(paid[id] ?? '', currency))
    const shareAmounts = participantIds.map(id => parseNonnegativeMajor(shares[id] ?? '', currency))
    return { totalMinor, currency, description: capitalizeDescription(description.trim()) || null, category, occurredOn, participantIds, contributionAmounts, shareAmounts }
  }
  let draft: ExpenseFinancialPayload | null = null
  try { draft = buildPayload() } catch { /* Partial input remains editable. */ }
  const financialChanged = !draft || financialEditsChanged(baseline.current.payload, draft)
  const dirty = !draft || financialChanged || metadataEditsChanged(baseline.current.payload, draft)
  const needsReview = shared && financialChanged

  const changeAmount = (value: string, nextCurrency = currency) => {
    try {
      const nextTotal = parseMajorAmount(value, nextCurrency)
      const current = draft ?? baseline.current.payload
      const scale = (amounts: number[]) => Object.fromEntries(current.participantIds.map((id, index) => [id,
        minorInput(rescaleMinorAmounts(amounts, current.totalMinor, nextTotal)[index], nextCurrency),
      ]))
      setPaid(scale(current.contributionAmounts))
      setShares(scale(current.shareAmounts))
    } catch { /* Validate after the user finishes entering an amount. */ }
    setTotal(value)
    setCurrency(nextCurrency)
    setError('')
  }

  const runMutation = async (mutation: () => Promise<void>) => {
    if (busy.current || mutationBlocked) return
    busy.current = true
    setSaving(true)
    setError('')
    setNotice('')
    const beforeVersion = baseline.current.version
    let completed = false
    try {
      await mutation()
      completed = true
      draftActive.current = false
      await onRefresh()
      setOpen(false)
      setPartialSave(false)
    } catch (cause) {
      if (completed) {
        setNotice(copy('Saved. Reload the page to refresh your records.', '已保存。请刷新页面以更新记录。'))
        setFailClosed(true)
      } else {
        if (baseline.current.version > beforeVersion) setPartialSave(true)
        const disposition = financialFailureDisposition(machineCode(cause))
        if (disposition === 'fail_closed' || disposition === 'refetch') setFailClosed(true)
        if (disposition === 'refetch') {
          draftActive.current = false
          setNotice(t('changeRequest.changedRefresh'))
        }
        setError(friendlyErrorKey(cause))
        if (baseline.current.version > beforeVersion || disposition === 'refetch') {
          try { await onRefresh() } catch { /* Keep the acknowledged save version for retry. */ }
        }
      }
    } finally {
      busy.current = false
      setSaving(false)
    }
  }
  const save = async (payload: ExpenseFinancialPayload) => {
    const moneyChanged = financialEditsChanged(baseline.current.payload, payload)
    if (mode === 'metadata' && moneyChanged) { setFailClosed(true); return }
    await runMutation(async () => {
      if (!moneyChanged || mode === 'financial') {
        await saveExpenseEdits(baseline.current, payload, ledgerRepository, applied => { baseline.current = applied })
      } else if (mode === 'correction') {
        await expenseChangeRepository.proposeDirectChange({ requestId: generateId(), targetExpenseId: expense.id, expectedTargetVersion: expense.version, kind: 'correction', replacement: payload })
      } else if (mode === 'space_correction') {
        await expenseChangeRepository.correctSpaceExpense({ requestId: generateId(), targetExpenseId: expense.id, expectedVersion: expense.version, replacement: payload })
      }
    })
  }
  const submit = () => {
    try {
      const payload = buildPayload()
      if (financialEditsChanged(baseline.current.payload, payload)) {
        for (const amounts of [payload.contributionAmounts, payload.shareAmounts]) {
          reconcileMinorAmounts(Object.fromEntries(payload.participantIds.map((id, index) => [id, amounts[index]])), payload.totalMinor)
        }
      }
      if (needsReview && !reviewPayload) { setReviewPayload(payload); setError('') }
      else void save(reviewPayload ?? payload)
    } catch { setError(shared ? 'expenseAction.amountsMustReconcile' : 'error.validAmount') }
  }
  const cancel = async () => runMutation(async () => {
    if (mode === 'request_cancellation') {
      await expenseChangeRepository.proposeDirectChange({ requestId: generateId(), targetExpenseId: expense.id, expectedTargetVersion: baseline.current.version, kind: 'cancellation' })
    } else if (onCancelExpense) await onCancelExpense(expense.id)
    else await ledgerRepository.voidExpense(expense.id, baseline.current.version)
  })
  const cancellationAction = policy.actions.find(action => action === 'cancel' || action === 'request_cancellation')
  const beginCancellation = (action: ExpenseAction) => {
    setMode(action === 'request_cancellation' ? 'request_cancellation' : 'cancel')
    setReviewPayload(null)
    setError('')
  }

  return <>
    <button type="button" className={triggerClassName ?? 'ms-btn-ghost min-h-10 px-3 py-2 text-xs'} aria-haspopup="dialog" aria-expanded={open}
      aria-label={copy(`Edit ${expenseName}`, `编辑 ${expenseName}`)} onClick={openSheet}>
      {triggerClassName === 'home-record-trigger' ? <span className="home-sr">{copy(`Edit ${expenseName}`, `编辑 ${expenseName}`)}</span> : trigger ?? <QuickIcon name="edit" size={16} />}
    </button>
    {open ? createPortal(<EditorDialog titleId={`expense-action-${expense.id}`} closing={closing} onClose={requestClose}>
      <header className="expense-editor-header">
        <span className="expense-editor-icon"><QuickIcon name={({ Drinks: 'Drink', Transportation: 'Transport', Flight: 'Travel', Accommodation: 'Stay', Activities: 'Fun', Sightseeing: 'Travel' } as Record<string, string>)[category] ?? category} size={24} /></span>
        <div><h2 id={`expense-action-${expense.id}`}>{editing ? copy('Edit record', '编辑记录') : mode === 'view_request' ? t('expenseAction.viewRequest') : t('expenseAction.cancelExpense')}</h2><p>{subtitle}</p></div>
        <button type="button" className="expense-editor-close" onClick={requestClose} disabled={saving} aria-label={t('common.close')}><QuickIcon name="close" size={18} /></button>
      </header>
      <form className="expense-editor-form" onSubmit={event => { event.preventDefault(); if (editing) submit(); else if (mode !== 'view_request') void cancel() }}>
        {partialSave ? <p className="expense-editor-notice" role="status">{copy('Amount and split saved. Details are not saved yet; retry saves only the remaining details.', '金额与分摊已保存，资料尚未保存；重试只会保存剩余资料。')}</p> : null}
        {notice ? <p className="expense-editor-notice" role="status">{notice}</p> : null}
        {error || statusNotice ? <p className="expense-editor-error" role="alert">{error ? t(error) : statusNotice}</p> : null}
        {editing && !reviewPayload ? <fieldset disabled={saving || mutationBlocked} className="expense-editor-fields">
          <label className="expense-editor-label" htmlFor={`edit-amount-${expense.id}`}>{copy('Amount', '金额')}</label>
          <div className="expense-editor-amount">
            <select aria-label={t('expenseAction.currency')} value={currency} disabled={mode !== 'financial'} onChange={event => changeAmount(total, event.target.value)}>
              {CURRENCIES.map(item => <option key={item.code} value={item.code}>{item.symbol} · {item.code}</option>)}
            </select>
            <input id={`edit-amount-${expense.id}`} aria-label={t('expenseAction.amount')} inputMode="decimal" value={total} readOnly={mode === 'metadata'} required onChange={event => changeAmount(event.target.value)} />
          </div>
          <label className="expense-editor-label expense-editor-description">{t('expenseAction.description')}<input className="ms-input" value={description} autoCapitalize="sentences" onChange={event => setDescription(capitalizeDescription(event.target.value))} /></label>
          <div className="expense-editor-pair">
            <label className="expense-editor-label">{t('expenseAction.category')}<select className="ms-input" value={category} onChange={event => setCategory(event.target.value)}>
              {!SELECTABLE_EXPENSE_CATEGORIES.some(item => item === category) ? <option value={category}>{category}</option> : null}
              {SELECTABLE_EXPENSE_CATEGORIES.map(item => <option key={item} value={item}>{t(categoryKey(item))}</option>)}
            </select></label>
            <label className="expense-editor-label">{t('expenseAction.date')}<input className="ms-input" type="date" required value={occurredOn} onChange={event => setOccurredOn(event.target.value)} /></label>
          </div>
          {shared ? <div className="expense-editor-split">
            <button type="button" className="expense-editor-split-toggle" aria-expanded={splitOpen} aria-controls={splitOpen ? `edit-split-${expense.id}` : undefined} onClick={() => setSplitOpen(value => !value)}><QuickIcon name="split" size={20} /><span>{copy('Split details', '分摊资料')}</span><span aria-hidden="true" className={splitOpen ? 'is-open' : ''}>⌄</span></button>
            {splitOpen ? <div className="expense-editor-split-table" id={`edit-split-${expense.id}`}>
              <div className="expense-editor-split-head"><span>{copy('Person', '参与者')}</span><span>{copy('Paid', '支付')}</span><span>{copy('Share', '分摊')}</span></div>
              {orderedParticipations.map(person => <div className="expense-editor-split-row" key={person.id}>
                <span>{person.participantId === currentParticipantId ? t('common.you') : person.nameSnapshot}</span>
                <input aria-label={t('expenseAction.paidBy', { name: person.nameSnapshot })} inputMode="decimal" value={paid[person.participantId] ?? ''} readOnly={mode === 'metadata'} onChange={event => setPaid(current => ({ ...current, [person.participantId]: event.target.value }))} />
                <input aria-label={t('expenseAction.shareFor', { name: person.nameSnapshot })} inputMode="decimal" value={shares[person.participantId] ?? ''} readOnly={mode === 'metadata'} onChange={event => setShares(current => ({ ...current, [person.participantId]: event.target.value }))} />
              </div>)}
            </div> : <p className="expense-editor-hint">{orderedParticipations.length} {copy('people · Existing split is kept', '人 · 保留现有分摊方式')}</p>}
            {mode !== 'financial' ? <p className="expense-editor-hint">{t('expenseAction.currencyLocked')}</p> : null}
          </div> : <div className="expense-editor-personal"><QuickIcon name="split" size={18} /><span>{copy('Personal expense', '个人账目')}</span><span>{copy('Only you', '仅自己')}</span></div>}
        </fieldset> : null}
        {editing && reviewPayload ? <div className="expense-editor-review" data-testid="expense-edit-review">
          <p className="expense-editor-label">{copy('Review changes', '检查修改')}</p>
          <div className="expense-editor-change"><MoneyText value={formatMinorAmount(baseline.current.payload.totalMinor, baseline.current.payload.currency)} /><span>→</span><MoneyText value={formatMinorAmount(reviewPayload.totalMinor, reviewPayload.currency)} /></div>
          <p>{capitalizeDescription(reviewPayload.description ?? t(categoryKey(reviewPayload.category)))}</p>
          <div className="expense-editor-review-people">{orderedParticipations.map((person, index) => <div key={person.id}>
            <span>{person.participantId === currentParticipantId ? t('common.you') : person.nameSnapshot}</span>
            <span>{copy('Paid', '支付')}: <MoneyText value={formatMinorAmount(baseline.current.payload.contributionAmounts[index], baseline.current.payload.currency)} /> → <MoneyText value={formatMinorAmount(reviewPayload.contributionAmounts[index], reviewPayload.currency)} /></span>
            <span>{copy('Share', '分摊')}: <MoneyText value={formatMinorAmount(baseline.current.payload.shareAmounts[index], baseline.current.payload.currency)} /> → <MoneyText value={formatMinorAmount(reviewPayload.shareAmounts[index], reviewPayload.currency)} /></span>
          </div>)}</div>
          {mode === 'correction' ? <p className="expense-editor-hint">{t('expenseAction.noEffectUntilApproved')}</p> : mode === 'space_correction' ? <p className="expense-editor-hint">{t('expenseAction.unchangedPrincipals')}</p> : policy.financialEditRequiresReconfirmation ? <p className="expense-editor-hint">{t('expenseAction.reconfirmWarning')}</p> : null}
        </div> : null}
        {mode === 'cancel' || mode === 'request_cancellation' ? <div className="expense-editor-cancel-confirm"><p>{expenseName}</p><p>{t(mode === 'cancel' ? 'expenseAction.cancelHelp' : 'expenseAction.cancellationRequestHelp')}</p></div> : null}
        {mode === 'view_request' ? <p className="expense-editor-notice">{t('expenseAction.requestFrozen')}</p> : <footer className="expense-editor-footer">
          {reviewPayload || !editing ? <button type="button" className="expense-editor-back" disabled={saving} onClick={() => { setReviewPayload(null); setMode(initialMode()) }}>{t('common.back')}</button> : null}
          <button type="submit" className="ms-btn-primary expense-editor-save" disabled={saving || mutationBlocked || (editing && !dirty)}>
            {saving ? t('expenseAction.saving') : !editing ? t(mode === 'cancel' ? 'expenseAction.confirmCancel' : 'expenseAction.sendCancellationRequest') : reviewPayload ? mode === 'correction' ? t('expenseAction.submitCorrection') : mode === 'space_correction' ? t('expenseAction.submitSpaceCorrection') : copy('Save changes', '保存修改') : needsReview ? copy('Review changes', '检查修改') : copy('Save changes', '保存修改')}
          </button>
          {editing && !reviewPayload && cancellationAction ? <button type="button" className="expense-editor-cancel-link" disabled={saving || mutationBlocked} onClick={() => beginCancellation(cancellationAction)}>{t(cancellationAction === 'cancel' ? 'expenseAction.cancelExpense' : 'expenseAction.requestCancellation')}</button> : null}
        </footer>}
      </form>
    </EditorDialog>, document.getElementById('root') ?? document.body) : null}
  </>
}

function EditorDialog({ titleId, closing, onClose, children }: { titleId: string; closing: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useAccessibleDialog<HTMLElement>(onClose)
  const swipeStart = useRef<number | null>(null)
  useEffect(() => {
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [])
  return <div className={`expense-editor-backdrop${closing ? ' is-closing' : ''}`}>
    <div className="tt-sheet-scrim expense-editor-scrim" data-testid="expense-editor-scrim" aria-hidden="true" onClick={onClose} />
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="expense-editor">
      <div className="expense-editor-handle" aria-hidden="true" onPointerDown={event => { swipeStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerUp={event => { if (swipeStart.current !== null && event.clientY - swipeStart.current > 48) onClose(); swipeStart.current = null }} onPointerCancel={() => { swipeStart.current = null }} />
      {children}
    </section>
  </div>
}
function amountInputs(expense: CanonicalExpense, kind: 'paid' | 'share'): Record<string, string> {
  const snapshot = expenseEditSnapshot(expense).payload
  const amounts = kind === 'paid' ? snapshot.contributionAmounts : snapshot.shareAmounts
  return Object.fromEntries(snapshot.participantIds.map((id, index) => [id, minorInput(amounts[index], expense.currency)]))
}
function minorInput(amountMinor: number, currency: string): string { return (amountMinor / 10 ** currencyExponent(currency)).toFixed(currencyExponent(currency)) }
function parseNonnegativeMajor(value: string, currency: string): number { return /^0+(?:\.0*)?$/.test(value.trim()) ? 0 : parseMajorAmount(value, currency) }

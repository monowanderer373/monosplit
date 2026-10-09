import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../store/useStore'
import { useT } from '../lib/i18n'
import { formatMinorAmount } from '../lib/money'
import { localeForLang, formatDate } from '../lib/locale'
import { localCalendarDate } from '../lib/homeView'
import { buildCollectPayItems, collectPayPreviews, collectPayTotals, financialFingerprint, previewCollectPayReceipt, type CollectPayItem, type CollectPaySnapshot } from '../lib/collectPay'
import { collectPayService, CollectPaySaveError, type CollectPayFormInput, type CollectPayPreview, type CollectPayAttempt } from '../lib/collectPayRepository'
import { collectPayErrorKey } from '../lib/collectPayErrors'
import { generateId } from '../lib/id'
import ExpenseActionSheet from '../components/ExpenseActionSheet'
import SettlementHistoryList from '../components/SettlementHistoryList'
import '../components/collectpay/collectpay.css'
import { resetVerifiedHomeCache } from '../hooks/useHomeData'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { useRouteScroll } from '../hooks/useRouteScroll'

type CollectPayResult = Awaited<ReturnType<typeof collectPayService.save>>

export default function CollectPayPage() {
  const { authUser, loading } = useAuth()
  const t = useT()
  if (loading) return <main className="cp-scope cp-page"><p role="status">{t('app.loading')}</p></main>
  if (!authUser?.participantId || authUser.isAnonymous) return <main className="cp-scope cp-page"><p>{t('friendlyError.accountRequired')}</p></main>
  return <CollectPayController key={authUser.participantId} owner={authUser.participantId} timezone={authUser.timezone ?? 'Asia/Kuala_Lumpur'} />
}

function CollectPayController({ owner, timezone }: { owner: string; timezone: string }) {
  const [snapshot, setSnapshot] = useState<CollectPaySnapshot | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const epoch = useRef(0)
  const { refresh: refreshLedger } = usePersonalLedger()
  const refresh = useCallback(async () => {
    const token = ++epoch.current
    try {
      const [next] = await Promise.all([collectPayService.load(owner), refreshLedger()])
      if (token !== epoch.current) return
      resetVerifiedHomeCache(); setSnapshot(next); setStatus('ready')
    } catch { if (token === epoch.current) setStatus('error') }
  }, [owner, refreshLedger])
  const invalidate = useCallback(() => { epoch.current++ }, [])
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void refresh() }); return () => { active = false; invalidate() } }, [refresh, invalidate])
  return <CollectPayScreen snapshot={snapshot} status={status} onRefresh={refresh} timezone={timezone} />
}

export function CollectPayScreen({ snapshot, status, onRefresh, timezone, service = collectPayService }: {
  snapshot: CollectPaySnapshot | null; status: 'loading' | 'ready' | 'error'; onRefresh: () => Promise<void>
  timezone: string; service?: typeof collectPayService
}) {
  const t = useT()
  const lang = useStore(s => s.lang)
  const { direction: routeDirection } = useParams()
  const direction = routeDirection === 'pay' ? 'pay' : 'collect'
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  useRouteScroll(status === 'ready', snapshot?.owner ?? '')
  const tab = params.get('tab') === 'history' ? 'history' : 'outstanding'
  const filter = params.get('filter') ?? 'all'
  const selectedKey = params.get('item')
  const [action, setAction] = useState('')
  const mutationLock = useRef(false)
  const [result, setResult] = useState<(CollectPayResult & { itemKey: string }) | null>(null)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<Record<string, CollectPayFormInput>>({})
  const allItems = snapshot ? buildCollectPayItems(snapshot).filter(i => i.direction === direction) : []
  const items = allItems.filter(i => filter === 'all' || i.source === filter)
  const selected = allItems.find(i => i.key === selectedKey)
  const resultPayment = snapshot?.payments.find(payment => payment.id === result?.id)
  let feedback: CollectPayResult['kind'] | '' = result?.itemKey === selectedKey ? result.kind : ''
  if (feedback && resultPayment?.allocations.length) {
    feedback = resultPayment.allocations.every(allocation => allocation.state === 'accepted') ? 'confirmed'
      : resultPayment.allocations.some(allocation => allocation.state === 'pending') ? feedback : ''
  }
  if (feedback === 'requested' && snapshot?.requests.some(request => request.id === result?.id && request.status !== 'open')) feedback = ''
  const onResult = (saved: CollectPayResult) => {
    if (selectedKey) setResult({ ...saved, itemKey: selectedKey })
  }
  const money = (amount: number, currency: string) => formatMinorAmount(amount, currency, localeForLang(lang))
  const names = new Map(snapshot?.expenses.flatMap(e => e.participations.map(p => [p.participantId, p.nameSnapshot] as const)))
  const openOriginal = (item: CollectPayItem) => navigate(item.context.scope === 'space' ? `/space/${item.context.spaceId}`
    : item.personId ? `/person/${item.personId}` : '/shared', { state: { cpBack: true } })
  const back = () => {
    if ((location.state as { cpBack?: boolean } | null)?.cpBack) navigate(-1)
    else if (selectedKey) { const next = new URLSearchParams(params); next.delete('item'); setParams(next, { replace: true }) }
    else navigate('/')
  }
  async function mutate(id: string, work: () => Promise<unknown>) {
    if (mutationLock.current) return
    mutationLock.current = true; setAction(id); setError('')
    try { await work(); await onRefresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'unknown_error') }
    finally { mutationLock.current = false; setAction('') }
  }
  const pendingExpenses = snapshot ? collectPayPreviews(snapshot).filter(p =>
    (filter === 'all' || p.source === filter) && (!selected || p.personId === selected.personId && selected.context.scope === 'direct')
  ) : []
  const totals = collectPayTotals(items)
  return <main className="cp-scope cp-page" data-testid="collect-pay-page">
    <header className="cp-header"><button type="button" className="cp-icon" onClick={back} aria-label={t('cp.back')}>←</button>
      <h1>{selected ? selected.otherName || t('common.member') : t(direction === 'pay' ? 'home.payable' : 'home.toCollect')}</h1>
      <button type="button" className="cp-icon" aria-label={t('common.retry')} onClick={() => void onRefresh()}>↻</button></header>
    {status === 'loading' ? <p role="status">{t('app.loading')}</p> : null}
    {status === 'error' ? <section className="cp-panel" role="alert"><p>{t('cp.unavailable')}</p><button className="cp-secondary" onClick={() => void onRefresh()}>{t('common.retry')}</button></section> : null}
    {snapshot ? <div className="cp-content" hidden={status !== 'ready'}>
      {error ? <p className="cp-error" role="alert">{t(error === 'balance_changed' || error === 'version_conflict' ? 'cp.changed' : collectPayErrorKey(error))}</p> : null}
      {feedback ? <p className={`cp-feedback ${feedback !== 'confirmed' ? 'is-pending' : ''}`} role="status">{t(feedback === 'requested' ? 'cp.requested' : feedback === 'pending' ? 'cp.recordedPending' : 'cp.recordedConfirmed')}</p> : null}
      {selectedKey && !selected ? <section className="cp-panel"><p>{t('cp.changed')}</p><button className="cp-secondary" onClick={back}>{t('cp.back')}</button></section> : selected ? <>
        <section className={`cp-panel cp-summary is-${direction}`}>
          <p>{direction === 'pay' ? t('settlement.youOwe', { name: selected.otherName || t('common.member') }) : t('settlement.personOwes', { debtor: selected.otherName || t('common.member'), creditor: t('common.you') })}</p>
          <strong className="cp-total">{money(selected.remainingMinor, selected.currency)}</strong>
          <p>{selected.label || t('cp.direct')}</p>
        </section>
        <p className="cp-help">{t('cp.scopeHelp')}</p>
        <dl className="cp-panel cp-breakdown"><div><dt>{t('cp.original')}</dt><dd>{money(selected.originalNetMinor, selected.currency)}</dd></div>
          <div><dt>{t('cp.confirmed')}</dt><dd>{money(selected.confirmedNetMinor, selected.currency)}</dd></div>
          <div><dt>{t('cp.remaining')}</dt><dd>{money(selected.remainingMinor, selected.currency)}</dd></div></dl>
        {direction === 'collect' && selected.payments.some(p => p.allocations.some(a => a.creditorParticipantId === snapshot.owner && a.state === 'pending')) ?
          <button type="button" className="cp-primary" onClick={() => {
            document.getElementById('cp-payment-history')?.scrollIntoView({ block: 'start', behavior: 'auto' })
            document.querySelector<HTMLSelectElement>('#cp-payment-history select')?.focus({ preventScroll: true })
          }}>{t('cp.recordCollect')}</button> : selected.canPay ? <PaymentForm key={selected.key} item={selected} snapshot={snapshot} timezone={timezone} service={service}
          draft={drafts[selected.key]} onDraft={draft => setDrafts(old => { const next = { ...old }; if (draft) next[selected.key] = draft; else delete next[selected.key]; return next })}
          onRefresh={onRefresh} onResult={onResult} /> : selected.remainingMinor > 0 ? <p className="cp-help">{t('cp.unsupported')}</p> : null}
        <section className="cp-sources"><h2>{t('cp.sources')}</h2>
          {selected.expenses.map(expense => <article className="cp-panel cp-source" key={expense.id}>
            <h3>{expense.description || t('expense.receiptUntitled')}</h3><p>{formatDate(expense.occurredOn, lang)} · {money(expense.totalMinor, expense.currency)}</p>
            <p>{t('expense.paidBy')}: {expense.payerContributions.filter(p => p.amountMinor > 0).map(p => expense.participations.find(a => a.id === p.expenseParticipationId)?.nameSnapshot ?? t('common.member')).join(', ')}</p>
            <details className="cp-original"><summary>{t('cp.openExpense')}</summary>
              <dl className="cp-breakdown">{expense.participations.map(participant => <div key={participant.id}>
                <dt>{participant.nameSnapshot}</dt><dd>{t('expense.paidBy')}: {money(expense.payerContributions.find(p => p.expenseParticipationId === participant.id)?.amountMinor ?? 0, expense.currency)}<br />
                  {t('cp.share')}: {money(expense.shares.find(p => p.expenseParticipationId === participant.id)?.amountMinor ?? 0, expense.currency)}</dd>
              </div>)}</dl>
              <ExpenseActionSheet expense={expense} currentParticipantId={snapshot.owner}
                spaceRole={selected.context.scope === 'space' ? snapshot.spaces.find(s => s.space.id === expense.spaceId)?.role : null}
                onRefresh={onRefresh} trigger={t('cp.manageExpense')} triggerClassName="cp-secondary" />
            </details>
          </article>)}
        </section>
        <button type="button" className="cp-secondary" onClick={() => openOriginal(selected)}>{t('cp.openOriginal')}</button>
        <PaymentHistory item={selected} snapshot={snapshot} service={service} timezone={timezone} action={action} mutate={mutate} onRefresh={onRefresh} onResult={onResult} />
        <SettlementHistoryList context={selected.context} currentParticipantId={snapshot.owner} participantNames={names}
          expenses={selected.expenses} settlements={selected.balancePayments} />
      </> : <>
        <section className={`cp-panel cp-summary is-${direction}`}><p>{t('cp.outstanding')}</p>
          {totals.length ? totals.map(total => <strong className="cp-total" key={total.currency}>{money(total.amountMinor, total.currency)}</strong>)
            : <p>{t(direction === 'pay' ? 'cp.emptyPay' : 'cp.emptyCollect')}</p>}
        </section>
        <div className="cp-tabs" role="group" aria-label={t('cp.history')}>
          {(['outstanding', 'history'] as const).map(id => <button type="button" key={id} aria-pressed={tab === id} onClick={() => {
            const next = new URLSearchParams(params); next.set('tab', id); setParams(next, { replace: true })
          }}>{t(id === 'history' ? 'cp.history' : 'cp.outstanding')}</button>)}
        </div>
        <label className="cp-filter">{t('cp.filter')}<select value={filter} onChange={event => {
          const next = new URLSearchParams(params); next.set('filter', event.target.value); setParams(next, { replace: true })
        }}><option value="all">{t('cp.all')}</option>{(['friend', 'group', 'trip'] as const).filter(source => allItems.some(i => i.source === source)).map(source =>
          <option key={source} value={source}>{t(`cp.${source}`)}</option>)}</select></label>
        <div className="cp-groups">
          {[...new Set(items.map(i => i.otherId))].map(otherId => {
            const group = items.filter(i => i.otherId === otherId && (tab === 'history' ? i.payments.length > 0 || i.requests.length > 0
              : i.remainingMinor > 0 || i.payments.some(p => p.allocations.some(a => a.state === 'pending')) || i.requests.some(r => r.status === 'open')))
            if (!group.length) return null
            const collapsed = (params.get('collapsed') ?? '').split(',').includes(otherId)
            return <section key={otherId} className="cp-group"><button type="button" className="cp-group-toggle" aria-expanded={!collapsed} onClick={() => {
              const ids = new Set((params.get('collapsed') ?? '').split(',').filter(Boolean)); if (collapsed) ids.delete(otherId); else ids.add(otherId)
              const next = new URLSearchParams(params); next.set('collapsed', [...ids].join(',')); setParams(next, { replace: true })
            }}><span className="cp-avatar" aria-hidden="true">{(group[0].otherName || '?').slice(0, 1)}</span><span>{group[0].otherName || t('common.member')}</span>
              <span className="cp-group-money">{collectPayTotals(group).map(total => <span key={total.currency}>{money(total.amountMinor, total.currency)}</span>)}</span><span aria-hidden="true">{collapsed ? '⌄' : '⌃'}</span></button>
              {!collapsed ? group.map(item => <button type="button" className={`cp-panel cp-item is-${direction}`} key={item.key} onClick={() => {
                const next = new URLSearchParams(params); next.set('item', item.key); setResult(null); setParams(next, { state: { cpBack: true } })
              }}><span><strong>{item.label || t('cp.direct')}</strong><small>{item.expenses[0]?.description || t('cp.history')} · {item.expenses[0] ? formatDate(item.expenses[0].occurredOn, lang) : item.currency}</small>
                {item.payments.some(p => p.allocations.some(a => a.state === 'pending')) || item.requests.some(r => r.status === 'open') ? <small className="cp-badge">{t('cp.pending')}</small> : null}</span>
                <span className="cp-item-amount">{money(item.remainingMinor, item.currency)} <span aria-hidden="true">›</span></span></button>) : null}
            </section>
          })}
          {!items.some(i => tab === 'history' ? i.payments.length || i.requests.length : i.remainingMinor || i.requests.some(r => r.status === 'open') || i.payments.some(p => p.allocations.some(a => a.state === 'pending'))) ?
            <p className="cp-help">{t(tab === 'history' ? 'cp.emptyHistory' : direction === 'pay' ? 'cp.emptyPay' : 'cp.emptyCollect')}</p> : null}
        </div>
      </>}
      {pendingExpenses.length ? <section className="cp-pending"><h2>{t('cp.pending')}</h2><p>{t('cp.pendingHelp')}</p>
        {pendingExpenses.map(p => <button type="button" className="cp-panel cp-item" key={p.id} onClick={() => navigate(p.personId ? `/person/${p.personId}` : '/shared', { state: { cpBack: true } })}>
          <span><strong>{p.description}</strong><small>{p.label}</small><span className="cp-badge">{t(p.status === 'manual' ? 'cp.manual' : 'cp.pending')}</span></span></button>)}
      </section> : null}
    </div> : null}
  </main>
}

function PaymentForm({ item, snapshot, timezone, service, onRefresh, onResult, draft, onDraft }: {
  item: CollectPayItem; snapshot: CollectPaySnapshot; timezone: string; service: typeof collectPayService
  draft?: CollectPayFormInput; onDraft: (draft: CollectPayFormInput | null) => void
  onRefresh: () => Promise<void>; onResult: (result: CollectPayResult) => void
}) {
  const t = useT(), lang = useStore(s => s.lang)
  const [open, setOpen] = useState(Boolean(draft))
  const [input, setInput] = useState<CollectPayFormInput>(draft ?? { intent: 'full', partialAmount: '', overpay: null,
    accountId: '', cashAmount: '', date: localCalendarDate(new Date(), timezone), note: '', sourceRequestId: null })
  const [preview, setPreview] = useState<CollectPayPreview | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [attempted, setAttempted] = useState(false)
  const lock = useRef(false), attempt = useRef<CollectPayAttempt | null>(null)
  const accounts = snapshot.accounts.filter(a => a.accountClass === 'asset' && !a.archived)
  const account = accounts.find(a => a.id === input.accountId)
  const money = (n: number, currency = item.currency) => formatMinorAmount(n, currency, localeForLang(lang))
  function update(value: Partial<CollectPayFormInput>) { const next = { ...input, ...value }; setInput(next); onDraft(next); setPreview(null); setError(''); attempt.current = null }
  async function review() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { setPreview(await service.preview(snapshot.owner, item.key, input)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'unknown_error'); await onRefresh() }
    finally { lock.current = false; setBusy(false) }
  }
  async function save() {
    if (lock.current || !preview) return
    lock.current = true; setBusy(true); setError(''); setAttempted(true)
    attempt.current ??= { requestId: generateId(), cashRequestId: generateId() }
    try {
      const result = await service.save(snapshot.owner, preview, attempt.current)
      onResult(result); await onRefresh(); onDraft(null); setOpen(false); setPreview(null); setAttempted(false); attempt.current = null
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'unknown_error'; setError(message)
      if (cause instanceof CollectPaySaveError && !cause.retrySameInput) { setPreview(null); setAttempted(false); attempt.current = null }
      await onRefresh()
    } finally { lock.current = false; setBusy(false) }
  }
  if (!open && item.remainingMinor <= 0) return null
  if (!open) return <button type="button" className="cp-primary" onClick={() => setOpen(true)}>{t(item.direction === 'pay' ? 'cp.recordPay' : 'cp.recordCollect')}</button>
  return <section className="cp-panel cp-form" data-testid="collect-pay-form"><h2>{t(item.direction === 'pay' ? 'cp.recordPay' : 'cp.recordCollect')}</h2>
    <p className="cp-help">{t(item.direction === 'pay' ? 'cp.recordHelp' : 'cp.requestHelp')}</p>
    <fieldset disabled={busy || attempted}><legend className="cp-sr">{t('settlement.chooseAmount')}</legend>
      <div className="cp-tabs">{(['full', 'partial'] as const).map(intent => <button type="button" key={intent} aria-pressed={input.intent === intent} onClick={() => update({ intent, overpay: null })}>{t(intent === 'full' ? 'settlement.full' : 'settlement.partial')}</button>)}</div>
      <label>{t('expense.amount')} {item.currency}{input.intent === 'partial' ? <input inputMode="decimal" type="text" value={input.partialAmount} aria-describedby="cp-form-error" onChange={e => update({ partialAmount: e.target.value })} /> : <output>{money(item.remainingMinor)}</output>}</label>
      {item.direction === 'pay' && input.intent === 'partial' && item.context.scope === 'direct' ? <label>{t('cp.overpay')}<select value={input.overpay ?? ''} onChange={e => update({ overpay: e.target.value === 'gift' || e.target.value === 'carry' ? e.target.value : null })}>
        <option value="">{t('cp.normal')}</option><option value="gift">{t('cp.gift')}</option><option value="carry">{t('cp.carry')}</option></select></label> : null}
      {item.direction === 'pay' ? <>
        <label>{t('cp.paidFrom')}<select value={input.accountId} onChange={e => update({ accountId: e.target.value })}><option value="">{t('cp.chooseAccount')}</option>{accounts.map(a => <option value={a.id} key={a.id}>{a.name} · {a.currency}</option>)}</select></label>
        {!accounts.length ? <p>{t('cp.noAccounts')}</p> : null}
        {account && account.currency !== item.currency ? <label>{t('cp.cashAmount')} · {account.currency}<input inputMode="decimal" value={input.cashAmount} onChange={e => update({ cashAmount: e.target.value })} /><small>{t('cp.fxHelp')}</small></label> : null}
        <label>{t('expense.date')}<input type="date" value={input.date} onChange={e => update({ date: e.target.value })} /></label>
        {item.requests.some(r => r.status === 'open') ? <label>{t('cp.chooseRequest')}<select value={input.sourceRequestId ?? ''} onChange={e => update({ sourceRequestId: e.target.value || null })}><option value="">{t('cp.noRequest')}</option>{item.requests.filter(r => r.status === 'open').map(r => <option value={r.id} key={r.id}>{money(r.amountMinor)}</option>)}</select></label> : null}
      </> : null}
      <label>{t('cp.note')}<textarea value={input.note} onChange={e => update({ note: e.target.value })} rows={2} /></label>
    </fieldset>
    {error ? <p className="cp-error" id="cp-form-error" role="alert">{t(error === 'balance_changed' && !attempted ? 'cp.changed' : 'cp.fieldError')}<br />{t(error === 'balance_changed' && attempted ? 'cp.retryHelp' : collectPayErrorKey(error))}</p> : null}
    {attempted && error ? <p className="cp-help">{t('cp.retryHelp')}</p> : null}
    {!preview ? <button type="button" className="cp-primary" disabled={busy} onClick={() => void review()}>{t(busy ? 'app.loading' : 'cp.preview')}</button> : <>
      <section className="cp-preview" data-testid="collect-pay-preview"><strong>{money(preview.sharedAmountMinor)}</strong>
        {account ? <p>{account.name} · {money(preview.cashAmountMinor, account.currency)}</p> : null}
        {item.direction === 'pay' ? <p>{formatDate(input.date, lang)}</p> : null}
        <p>{t(preview.remainingAfterMinor < 0 ? 'cp.creditAfter' : 'cp.afterConfirmation', { amount: money(Math.abs(preview.remainingAfterMinor)) })}</p>
      </section>
      <button type="button" className="cp-primary" disabled={busy} onClick={() => void save()}>{t(busy ? 'app.loading' : item.direction === 'collect' ? 'cp.request' : 'cp.confirmPay')}</button>
    </>}
    {!attempted ? <button type="button" className="cp-secondary" disabled={busy} onClick={() => setOpen(false)}>{t('expense.cancel')}</button> : null}
  </section>
}

function PaymentHistory({ item, snapshot, service, timezone, action, mutate, onRefresh, onResult }: {
  item: CollectPayItem; snapshot: CollectPaySnapshot; service: typeof collectPayService; timezone: string; action: string
  mutate: (id: string, work: () => Promise<unknown>) => Promise<void>; onRefresh: () => Promise<void>
  onResult: (result: CollectPayResult) => void
}) {
  const t = useT(), lang = useStore(s => s.lang)
  const [receivingAccount, setReceivingAccount] = useState<Record<string, string>>({})
  const [reverseId, setReverseId] = useState('')
  const receiveIds = useRef(new Map<string, string>())
  const reversalIds = useRef(new Map<string, string>())
  const accounts = snapshot.accounts.filter(a => a.accountClass === 'asset' && !a.archived)
  return <section className="cp-history" id="cp-payment-history"><h2>{t('cp.history')}</h2>
    {item.payments.flatMap(payment => payment.allocations.filter(a => a.creditorParticipantId === (item.direction === 'collect' ? snapshot.owner : item.otherId)).map(allocation => {
      const leg = snapshot.cashLegs.find(l => l.allocationId === allocation.id)
      const account = snapshot.accounts.find(a => a.id === leg?.accountId)
      const tracked = snapshot.cashTrackedPaymentIds.includes(payment.id)
      let receiptPreview: ReturnType<typeof previewCollectPayReceipt> | null = null, receiptError = ''
      if (allocation.state === 'pending' && item.direction === 'collect') {
        try { receiptPreview = previewCollectPayReceipt(snapshot, item, payment.id, allocation.id) }
        catch (cause) { receiptError = cause instanceof Error ? cause.message : 'invalid_settlement_preview' }
      }
      return <article className="cp-panel cp-history-row" key={allocation.id}>
        <strong>{formatMinorAmount(allocation.amountMinor, payment.currency, localeForLang(lang))}</strong><p>{formatDate(payment.paymentDate, lang)}</p>
        <p>{account?.name ?? t('cp.accountUnknown')}{leg ? ` · ${formatMinorAmount(leg.amountMinor, leg.currency, localeForLang(lang))}` : ''}</p>
        <span className="cp-badge">{t(allocation.state === 'pending' ? 'cp.pending' : allocation.state === 'accepted' ? 'history.settlementAccepted' : allocation.state === 'reversed' ? 'history.settlementReversed' : allocation.state === 'declined' ? 'history.settlementDeclined' : 'history.settlementProposalCancelled')}</span>
        {payment.note ? <p>{payment.note}</p> : null}
        {allocation.state === 'pending' && item.direction === 'collect' ? <>
          {receiptPreview ? <p className="cp-preview">{t(receiptPreview.remainingAfterMinor < 0 ? 'cp.creditAfter' : 'cp.afterReceipt', { amount: formatMinorAmount(Math.abs(receiptPreview.remainingAfterMinor), item.currency, localeForLang(lang)) })}</p> : null}
          {receiptError ? <p className="cp-error" role="alert">{t(collectPayErrorKey(receiptError))}</p> : null}
          <p className="cp-help">{t('cp.paymentDate')}: {formatDate(payment.paymentDate, lang)}</p>
          {tracked ? <label>{t('cp.receivedInto')}<select value={receivingAccount[allocation.id] ?? (leg?.role === 'receiver' ? leg.accountId : '')} disabled={Boolean(action) || leg?.role === 'receiver'} onChange={e => setReceivingAccount(a => ({ ...a, [allocation.id]: e.target.value }))}>
            <option value="">{t('cp.chooseAccount')}</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label> : <p className="cp-help">{t('cp.legacyReceipt')}</p>}
          <button type="button" className="cp-primary" disabled={Boolean(action) || Boolean(receiptError) || tracked && !receivingAccount[allocation.id] && leg?.role !== 'receiver'} onClick={() => void mutate(allocation.id, async () => {
            let requestId = receiveIds.current.get(allocation.id); if (!requestId) { requestId = generateId(); receiveIds.current.set(allocation.id, requestId) }
            await service.confirmReceived(snapshot.owner, payment, allocation.id, receivingAccount[allocation.id] ?? (leg?.role === 'receiver' ? leg.accountId : ''), requestId, financialFingerprint(snapshot, item))
            onResult({ kind: 'confirmed', id: payment.id }); await onRefresh()
          })}>{t('cp.confirmReceipt')}</button>
          <button type="button" className="cp-secondary" disabled={Boolean(action)} onClick={() => void mutate(allocation.id, () => service.repository.respond(allocation.id, 'declined', payment.version))}>{t('common.decline')}</button>
        </> : null}
        {allocation.state === 'pending' && item.direction === 'pay' ? <button type="button" className="cp-secondary" disabled={Boolean(action)} onClick={() => void mutate(allocation.id, () => service.repository.cancel(allocation.id, payment.version))}>{t('cp.cancelPayment')}</button> : null}
        {allocation.state === 'accepted' && allocation.reversalMinor === 0 && item.direction === 'collect' ? <>
          {reverseId === allocation.id ? <><p>{t('cp.reverseHelp')}</p><button type="button" className="cp-secondary" disabled={Boolean(action)} onClick={() => void mutate(allocation.id, () => { let id = reversalIds.current.get(allocation.id); if (!id) { id = generateId(); reversalIds.current.set(allocation.id, id) }; return service.repository.reverse(id, allocation.id, payment.version) })}>{t('cp.reverseConfirm')}</button></>
            : <button type="button" className="cp-secondary" disabled={Boolean(action)} onClick={() => setReverseId(allocation.id)}>{t('cp.reverse')}</button>}
        </> : null}
      </article>
    }))}
    {item.requests.map(request => <article className="cp-panel cp-history-row" key={request.id}>
      <strong>{formatMinorAmount(request.amountMinor, request.currency, localeForLang(lang))}</strong><p>{formatDate(localCalendarDate(new Date(request.createdAt), timezone), lang)}</p>
      <span className="cp-badge">{t(`cp.requestStatus.${request.status}`)}</span>{request.note ? <p>{request.note}</p> : null}
      {request.status === 'open' && item.direction === 'collect' ? <button type="button" className="cp-secondary" disabled={Boolean(action)} onClick={() => void mutate(request.id, () => service.repository.cancelRequest(request.id, request.version))}>{t('cp.cancelRequest')}</button> : null}
    </article>)}
    {!item.payments.length && !item.requests.length ? <p>{t('cp.emptyHistory')}</p> : null}
  </section>
}

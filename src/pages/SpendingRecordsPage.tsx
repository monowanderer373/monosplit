import { monthLabel } from '../lib/spendingView'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSpendingView } from '../hooks/useSpendingView'
import { useExpenseChanges } from '../hooks/useExpenseChanges'
import { useT, categoryKey } from '../lib/i18n'
import { formatDate } from '../lib/locale'
import { capitalizeDescription } from '../lib/description'
import { spendingQuery } from '../lib/spendingView'
import ExpenseActionSheet from '../components/ExpenseActionSheet'
import { InsightIcon, InsightPage, SpendingCount, SpendingMoney, SpendingState } from '../components/insights/SpendingUI'

const categoryIcons: Record<string, string> = { Food: 'utensils', Drinks: 'coffee', Groceries: 'cart', Transportation: 'car', Flight: 'car', Accommodation: 'bed', Shopping: 'bag', Sightseeing: 'ticket', Activities: 'ticket' }
export default function SpendingRecordsPage() {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const { auth, ledger, lang, filter, snapshot, ready, authenticated } = useSpendingView()
  const changes = useExpenseChanges(authenticated && ready, ledger.refresh, auth.authUser?.id ?? '')
  const [page, setPage] = useState({ key: '', limit: 40 })
  const key = `${auth.authUser?.id}:${spendingQuery(filter)}`
  const limit = page.key === key ? page.limit : 40
  const groups = new Map<string, typeof snapshot.records>()
  for (const row of snapshot.records.slice(0, limit)) {
    const date = row.expense.occurredOn
    groups.set(date, [...(groups.get(date) ?? []), row])
  }
  const back = () => location.state?.fromInsights ? navigate(-1) : navigate(`/insights?${spendingQuery(filter)}`, { replace: true })
  if (auth.loading) return <InsightPage records><SpendingState status="loading" /></InsightPage>
  if (auth.sessionError) return <InsightPage records><SpendingState status="error" retry={auth.retrySession} /></InsightPage>
  if (!authenticated) return <InsightPage records><p>{t('ledger.privateTitle')}</p><Link className="i-link" to="/login">{t('common.signIn')}</Link></InsightPage>
  return <InsightPage records>
    <button className="i-link i-records-back" onClick={back}><InsightIcon name="chevron-left" />{t('insights.title')}</button>
    <h1 className="i-records-heading">{t('spending.records')}</h1>
    <p className="i-filter-context">{monthLabel(filter.month, lang)} · {t(`spending.${filter.scope}`)} · {snapshot.currency}</p>
    {!ready ? <SpendingState status={ledger.expensesStatus === 'error' ? 'error' : 'loading'} retry={ledger.refresh} /> : <>
      <section className="i-card i-records-summary"><div><p className="i-share-basis">{t('spending.total')}</p><p className="i-total" data-testid="spending-total"><SpendingMoney minor={snapshot.totalMinor} currency={snapshot.currency} /></p></div><span className="i-record-count"><SpendingCount count={snapshot.count} /></span><img className="i-popover-corner" src="/assets/insights/denim-corner.svg" alt="" /></section>
      <p className="i-records-explanation">{t('spending.explanation')}</p>
      {changes.error ? <p role="alert" className="i-state-card">{t('spending.actionsError')} <button className="i-link" onClick={() => void changes.refreshAuthoritative()}>{t('common.retry')}</button></p> : null}
      {!snapshot.count ? <SpendingState status="empty" /> : [...groups].map(([date, rows]) => <section key={date} className="i-date-group" aria-label={formatDate(date, lang)}>
        <h2 className="i-date-heading"><time dateTime={date}>{formatDate(date, lang)}</time></h2>
        {rows.map(row => {
          const expense = row.expense
          const shared = expense.scope !== 'personal'
          const content = <>
            <span className="i-record-icon"><InsightIcon name={categoryIcons[expense.category] ?? 'receipt'} /></span>
            <span className="i-record-copy"><span className="i-record-title">{capitalizeDescription(expense.description || t(categoryKey(expense.category || 'Other')))}</span><span className="i-record-meta">{shared ? `${t('spending.shared')} · ${t('spending.basis')}` : `${t('spending.personal')} · ${t(categoryKey(expense.category || 'Other'))}`}</span>
              {/* totalMinor is an actually returned canonical field behind expense RLS, never reconstructed from hidden shares. */}
              {shared ? <span className="i-record-bill">{t('spending.bill')} <SpendingMoney minor={expense.totalMinor} currency={expense.currency} /></span> : null}
            </span><span className="i-record-amount"><SpendingMoney minor={row.personalSpendingMinor} currency={expense.currency} /></span><InsightIcon name="chevron-right" />
          </>
          const className = `i-record-row ${shared ? 'i-record-row--shared' : ''}`
          return changes.loading || changes.error ? <div key={expense.id} className={className}>{content}</div> : <ExpenseActionSheet key={expense.id} expense={expense} currentParticipantId={ledger.participantId!} trigger={content} triggerClassName={className} pendingRequest={changes.requests.find(request => request.targetExpenseId === expense.id && request.state === 'pending')} onCancelExpense={ledger.voidExpense} onRefresh={changes.refreshAuthoritative} />
        })}
      </section>)}
      {limit < snapshot.count ? <button className="i-link i-load-more" onClick={() => setPage({ key, limit: limit + 40 })}>{t('spending.more')}</button> : snapshot.count ? <p className="i-list-end"><SpendingCount count={snapshot.count} /> · {t('spending.end')}</p> : null}
    </>}
  </InsightPage>
}

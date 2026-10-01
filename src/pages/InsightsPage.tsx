import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MoneyText from '../components/MoneyText'
import { useAuth } from '../hooks/useAuth'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { categoryKey, useT } from '../lib/i18n'
import { isBookedHomeExpense, localCalendarDate } from '../lib/homeView'
import { summarizeSpending } from '../lib/insightsModel'
import { localeForLang } from '../lib/locale'
import { formatMinorAmount } from '../lib/money'
import { useStore } from '../store/useStore'
const colors = ['#dfac84','#91aaa0','#d3c5a2','#b9a4a0','#a5b3be','#b4b294']
export default function InsightsPage() {
  const t = useT()
  const navigate = useNavigate()
  const lang = useStore((state) => state.lang)
  const zh = lang === 'zh'
  const { authUser, loading } = useAuth()
  const ledger = usePersonalLedger()
  const [month,setMonth] = useState(() => localCalendarDate(new Date(),authUser?.timezone ?? 'Asia/Kuala_Lumpur').slice(0,7))
  const [currency,setCurrency] = useState('')
  const [scope,setScope] = useState('all')
  const [view,setView] = useState('category')
  const rows = useMemo(() => ledger.participantId ? ledger.rows.filter(row => isBookedHomeExpense(row.expense,ledger.participantId!) && row.expense.occurredOn.startsWith(month) && (scope === 'all' || (scope === 'personal' ? row.expense.scope === 'personal' : row.expense.scope !== 'personal'))) : [],[ledger.rows,ledger.participantId,month,scope])
  const currencies = [...new Set(rows.map(row => row.expense.currency))].sort()
  const selectedCurrency = currencies.includes(currency) ? currency : currencies[0]
  const filtered = rows.filter(row => row.expense.currency === selectedCurrency)
  const summary = summarizeSpending(filtered.map(row => ({category:row.expense.category || 'Other',date:row.expense.occurredOn,amountMinor:row.personalSpendingMinor})))
  const money = (amount: number) => <MoneyText value={formatMinorAmount(amount,selectedCurrency || 'MYR',localeForLang(lang))} />
  if (loading) return <main className="ms-page flex min-h-dvh items-center justify-center">{t('ledger.opening')}</main>
  if (!authUser) return <main className="ms-page flex min-h-dvh items-center justify-center"><button className="ms-btn-primary" onClick={() => navigate('/login')}>{t('common.signIn')}</button></main>
  const gradient = summary.categories.map(([,amount],index) => {const start=summary.categories.slice(0,index).reduce((sum,[,value]) => sum+value,0)/summary.totalMinor*360;const end=start+amount/summary.totalMinor*360;return `${colors[index % colors.length]} ${start}deg ${end}deg`}).join(',')
  const dayAmounts = new Map(summary.days)
  const [year,monthNumber] = month.split('-').map(Number)
  const chartDays = Array.from({length:new Date(year,monthNumber,0).getDate()},(_,index) => { const date=`${month}-${String(index+1).padStart(2,'0')}`;return {date,amount:dayAmounts.get(date) ?? 0} })
  const maxDay = Math.max(1,...summary.days.map(([,amount]) => amount))
  return <main className="ms-page pb-28">
    <header><h1>{t('insights.title')}</h1><p className="mt-2 text-sm text-[var(--ms-text-secondary)]">{zh ? '看清每一笔，慢慢建立自己的节奏。' : 'A little clarity for your everyday spending.'}</p></header>
    <div className="tt-insights-filters">
      <label>{zh ? '月份' : 'Month'}<input className="ms-input" type="month" value={month} onChange={event => setMonth(event.target.value)} onInput={event => setMonth(event.currentTarget.value)} /></label>
      <label>{zh ? '范围' : 'Scope'}<select className="ms-input" value={scope} onChange={event => setScope(event.target.value)}><option value="all">{zh ? '全部' : 'All spending'}</option><option value="personal">{zh ? '个人' : 'Personal'}</option><option value="shared">{zh ? '共享' : 'Shared'}</option></select></label>
      <label>{zh ? '币种' : 'Currency'}<select className="ms-input" value={selectedCurrency || ''} disabled={!currencies.length} onChange={event => setCurrency(event.target.value)}>{currencies.length ? currencies.map(code => <option key={code}>{code}</option>) : <option value="">—</option>}</select></label>
    </div>
    {ledger.expensesStatus === 'loading' ? <p role="status">{t('ledger.opening')}</p> : ledger.expensesStatus === 'error' ? <p role="alert" className="text-[var(--ms-danger)]">{zh ? '账目未能载入，请刷新重试。' : 'Unable to load spending. Please refresh to retry.'}</p> : <>
      <section className="ms-card-hero p-5 mt-6"><p className="ms-label">{t('home.monthSpending')}</p><p className="tt-insights-total">{selectedCurrency ? money(summary.totalMinor) : '—'}</p><p className="text-sm text-[var(--ms-text-secondary)]">{filtered.length} {zh ? '笔已确认记录 · 仅计算你的份额' : 'booked records · your share only'}</p></section>
      <div className="tt-context-tabs flex gap-1 mt-6" role="tablist" aria-label={zh ? '分析视图' : 'Spending views'}>{[['category',zh ? '分类' : 'Categories'],['trend',zh ? '趋势' : 'Trend'],['ranking',zh ? '排行' : 'Ranking']].map(([id,label]) => <button key={id} role="tab" aria-selected={view===id} aria-controls="spending-panel" id={`spending-${id}`} className="ms-btn-ghost" onClick={() => setView(id)}>{label}</button>)}</div>
      <section id="spending-panel" role="tabpanel" aria-labelledby={`spending-${view}`} className="ms-card-hero mt-4 p-5">
        {!summary.totalMinor ? <p className="py-8 text-center text-[var(--ms-text-secondary)]">{zh ? '这个月份还没有支出记录。' : 'No spending in this month yet.'}</p> : view === 'trend' ? <><h2>{zh ? '每日支出' : 'Daily spending'}</h2><p className="mt-1 text-sm text-[var(--ms-text-secondary)]">{selectedCurrency}</p><div className="tt-trend" aria-hidden="true">{chartDays.map(({date,amount}) => <div key={date} title={`${date}: ${formatMinorAmount(amount,selectedCurrency,localeForLang(lang))}`} style={{height:`${amount ? Math.max(2,amount/maxDay*100) : 0}%`}} />)}</div><div className="tt-insight-rows">{summary.days.map(([date,amount]) => <div key={date}><span>{date}</span><strong>{money(amount)}</strong></div>)}</div></> : <><h2>{view==='ranking' ? (zh ? '支出排行' : 'Spending ranking') : (zh ? '支出分类' : 'Spending by category')}</h2>{view==='category' ? <div className="tt-donut" role="img" aria-label={zh ? '分类比例，明细如下' : 'Category proportions, detailed below'} style={{background:`conic-gradient(${gradient})`}}><div>{zh ? '你的支出' : 'Your spending'}</div></div> : null}<div className="tt-insight-rows">{summary.categories.map(([category,amount],index) => <div key={category}><span className="flex items-center gap-3">{view==='ranking' ? <span className="tt-ranking-number">{index+1}</span> : <span className="tt-category-dot" style={{background:colors[index%colors.length]}} />}{t(categoryKey(category))}</span><span className="text-right"><strong>{money(amount)}</strong><small className="block text-[var(--ms-text-secondary)]">{Math.round(amount/summary.totalMinor*100)}%</small></span></div>)}</div></>}
      </section>
    </>}
  </main>
}

import { categoryKey, useT } from '../../lib/i18n'
import { spendingCategoryColor, type SpendingTab, type spendingSnapshot } from '../../lib/spendingView'
import { CategoryDisk, SpendingMoney } from './SpendingUI'
import { currencyExponent } from '../../lib/money'

type Snapshot = ReturnType<typeof spendingSnapshot>
export default function SpendingCharts({ snapshot, tab, month, today, hidden }: { snapshot: Snapshot; tab: SpendingTab; month: string; today: string; hidden: boolean }) {
  const t = useT()
  if (hidden) return <p className="i-concealed" role="status">{t('spending.hidden')}</p>
  if (tab === 'trend') {
    const [year, number] = month.split('-').map(Number)
    const daysInMonth = new Date(Date.UTC(year, number, 0)).getUTCDate()
    const latestDay = Math.max(0, ...snapshot.days.map(([date]) => Number(date.slice(8, 10))))
    // Future dates without observations are not represented as confirmed zeros.
    const observedEnd = month < today.slice(0, 7) ? daysInMonth : month === today.slice(0, 7) ? Math.max(Number(today.slice(8, 10)), latestDay) : latestDay
    const amounts = new Map(snapshot.days)
    const values = Array.from({ length: observedEnd }, (_, index) => amounts.get(`${month}-${String(index + 1).padStart(2, '0')}`) ?? 0)
    const max = Math.max(1, ...values)
    const x = (index: number) => 34 + index / Math.max(1, values.length - 1) * 274
    const y = (amount: number) => 170 - amount / max * 130
    return <>
      <h2 className="i-section-heading">{t('spending.trendTitle')}</h2><p className="i-chart-context">{t(snapshot.currencies.some(c => c !== 'MYR') ? 'spending.fxChartBasis' : 'spending.chartCurrency',{currency:'MYR'})}</p>
      <svg className="i-trend-plot" viewBox="0 0 330 205" aria-hidden="true">
        {[0, 0.5, 1].map(value => <g key={value}><line x1="34" y1={y(max * value)} x2="308" y2={y(max * value)} stroke="var(--i-border)" strokeDasharray="2 4" /><text x="28" y={y(max * value) + 4} textAnchor="end">{(max * value / 10 ** currencyExponent(snapshot.currency)).toLocaleString('en-US', { useGrouping: true, maximumFractionDigits: 2 })}</text></g>)}
        {values.length > 1 ? <polyline fill="none" stroke="var(--i-denim)" strokeWidth="2" points={values.map((amount, index) => `${x(index)},${y(amount)}`).join(' ')} /> : null}
        {values.map((amount, index) => amount ? <circle key={index} cx={x(index)} cy={y(amount)} r="2.5" fill="var(--i-denim)" /> : null)}
        {[...new Set([0, Math.floor((values.length - 1) / 2), values.length - 1])].filter(index => index >= 0).map(index => <text key={index} x={x(index)} y="192" textAnchor="middle">{index + 1}</text>)}
      </svg>
      <div className="i-day-table">{snapshot.days.map(([date, amount]) => <div className="i-day-row" key={date}><time dateTime={date}>{date}</time><strong><SpendingMoney minor={amount} currency={snapshot.currency} /></strong></div>)}</div>
    </>
  }
  let offset = 0
  return <>
    <h2 className="i-section-heading">{t(tab === 'ranking' ? 'spending.rankingTitle' : 'spending.categoryTitle')}</h2>
    <p className="i-chart-context">{t(snapshot.currencies.some(c => c !== 'MYR') ? 'spending.fxChartBasis' : 'spending.chartCurrency', { currency: snapshot.currency })}</p>
    {tab === 'category' ? <div className="i-donut">
      <svg viewBox="0 0 210 210" role="img" aria-label={t('spending.chartLabel')}>
        {snapshot.categories.map(([category, amount]) => {
          const arc = amount / snapshot.totalMinor * 100
          const start = offset; offset += arc
          return <circle key={category} cx="105" cy="105" r="92" fill="none" stroke={spendingCategoryColor(category)} strokeWidth="26" pathLength="100" strokeDasharray={`${arc} ${100 - arc}`} strokeDashoffset={-start} transform="rotate(-90 105 105)" />
        })}
      </svg><span><strong><SpendingMoney minor={snapshot.totalMinor} currency="MYR" /></strong><span>{t(snapshot.currencies.some(c => c !== 'MYR') ? 'spending.fxEstimated' : 'spending.yourSpending')}</span></span>
    </div> : null}
    <div>{snapshot.categories.map(([category, amount], index) => <div key={category} className={tab === 'ranking' ? 'i-ranking-row' : 'i-legend-row'}>
      {tab === 'ranking' ? <span className="i-ranking-number">{String(index + 1).padStart(2, '0')}</span> : <CategoryDisk category={category} />}
      <span className="i-legend-name">{tab === 'category' ? <span className="i-color-dot" style={{ backgroundColor: spendingCategoryColor(category) }} /> : null}{t(categoryKey(category))}</span>
      <span className="i-legend-amount"><SpendingMoney minor={amount} currency={snapshot.currency} /><span className="i-legend-percent">{Math.round(amount / snapshot.totalMinor * 100)}%</span></span>
    </div>)}</div>
    <p className="i-chart-basis">{t('spending.explanation')}</p>
  </>
}

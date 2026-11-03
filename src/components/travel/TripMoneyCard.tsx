import { useState } from 'react'
import { useInsightsFx } from '../../hooks/useInsightsFx'
import { exactAmount } from '../../lib/fx'
import { systemForeignPerTarget, valueLines, type MoneyLine } from '../../lib/fxSettlement'
import { useT } from '../../lib/i18n'
import { currencyExponent } from '../../lib/money'
import { localeForLang } from '../../lib/locale'
import { useStore } from '../../store/useStore'
import './trip-money-card.css'

export function TripMoneyCard({ spending, shared, count, hidden, status, quoteCurrency = 'MYR', identity = '' }: {
  spending: readonly MoneyLine[]
  shared?: readonly MoneyLine[]
  count?: number
  hidden: boolean
  status: 'loading' | 'error' | 'ready'
  quoteCurrency?: string
  identity?: string
}) {
  const t = useT()
  const lang = useStore(s => s.lang)
  const target = quoteCurrency || 'MYR'
  const foreign = [...spending, ...(shared ?? [])].some(line => line.currency !== target)
  const fx = useInsightsFx(identity, status === 'ready' && foreign && !!identity)
  const [ratesOpen, setRatesOpen] = useState(false)
  if (status !== 'ready') return <div className="tw-money-card"><p>{t('home.mySpending')}</p><p className="tt-amount-state" role="status">{t(status === 'loading' ? 'home.loading' : 'home.amountUnavailable')}</p></div>
  if (hidden) return <div className="tw-money-card"><p>{t('home.mySpending')}</p><p className="tw-estimated-total" aria-label={t('travel.concealed')}>••••</p></div>
  const rows = spending.length ? spending : [{ currency: target, amountMinor: 0 }]
  const rateFor = (currency: string) => systemForeignPerTarget(currency, target, fx.snapshot)
  const mine = valueLines(rows, target, rateFor)
  const total = shared ? valueLines(shared, target, rateFor) : null
  const money = (minor: bigint | number, currency: string) => exactAmount(BigInt(minor), currencyExponent(currency), localeForLang(lang))
  const symbol = target === 'MYR' ? 'RM' : target
  return <div className="tw-money-card">
    <p>{t('home.mySpending')}</p>
    <p className="tw-estimated-total">{mine.totalMinor == null ? t('tw.estimateUnavailable') : <>≈ <span>{symbol}</span> {money(mine.totalMinor, target)}</>}</p>
    <dl className="tw-originals">{rows.map(line => <div className="tt-amount-line" key={line.currency}><dt>{line.currency}</dt><dd>{money(line.amountMinor, line.currency)}</dd></div>)}</dl>
    <p className="tw-rate-note">{mine.totalMinor == null ? t('tw.estimateUnavailable') : t('tw.referenceEstimate')} <button type="button" onClick={() => setRatesOpen(value => !value)}>{t('tw.rates')}</button></p>
    {ratesOpen ? <p className="tw-rate-note" role="status">{fx.snapshot.status}{fx.snapshot.fetchedAt ? ` · ${fx.snapshot.fetchedAt.slice(0, 10)}` : ''}{Object.values(fx.snapshot.rates)[0]?.rateDate ? ` · ${Object.values(fx.snapshot.rates)[0].rateDate}` : ''}</p> : null}
    {total && count != null ? <div className="tw-spending-foot"><span>{mine.totalMinor == null || total.totalMinor == null ? t('tw.estimateUnavailable') : `${t('tw.tripTotal')} ≈ ${symbol} ${money(total.totalMinor, target)}`}</span><span>{t(count === 1 ? 'tw.oneRecord' : 'tw.sharedRecords', { count })}</span></div> : null}
  </div>
}

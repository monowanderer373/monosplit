import type { PersonalLedgerRow } from './ledgerSummary'
import { isBookedHomeExpense } from './homeView'
import { summarizeSpending } from './insightsModel'
import { CURRENCIES } from './currency'
import { localeForLang } from './locale'
import { EXPENSE_CATEGORIES } from './categories'
import { currencyExponent } from './money'
import { fraction, addFraction, estimateMinor, roundFraction, reconcileEstimates, unavailableFx, type FxSnapshot, type Fraction } from './fx'

export type SpendingScope = 'all' | 'personal' | 'shared'
export type SpendingTab = 'category' | 'trend' | 'ranking'
export type SpendingFilter = { month: string; scope: SpendingScope; currency: string; tab: SpendingTab; fx?: string }
const currencyCodes = new Set(CURRENCIES.map(item => item.code))

export function spendingFilter(params: URLSearchParams, today: string): SpendingFilter {
  const month = params.get('month') ?? ''
  const scope = params.get('scope')
  const tab = params.get('tab')
  return {
    month: /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today.slice(0, 7),
    scope: scope === 'personal' || scope === 'shared' ? scope : 'all',
    currency: '', // Legacy Insights-only currency links now include all currencies.
    ...( /^[0-9a-f-]{36}$/i.test(params.get('fx') ?? '') ? { fx: params.get('fx')! } : {}),
    tab: tab === 'trend' || tab === 'ranking' ? tab : 'category',
  }
}

/** Derive every visual from ONE complete RLS-loaded ledger, never from the visible page. */
export function spendingSnapshot(rows: readonly PersonalLedgerRow[], participantId: string | null, filter: SpendingFilter, defaultCurrency: string, fx: FxSnapshot = unavailableFx) {
  const eligible = participantId ? rows.filter(row =>
    isBookedHomeExpense(row.expense, participantId)
    && !row.expense.id.startsWith('pending:')
    && row.expense.occurredOn.startsWith(`${filter.month}-`)
    && (filter.scope === 'all' || (filter.scope === 'personal' ? row.expense.scope === 'personal' : row.expense.scope !== 'personal')),
  ) : []
  const currencies = [...new Set(eligible.map(row => row.expense.currency))].sort((a,b) => a === 'MYR' ? -1 : b === 'MYR' ? 1 : a.localeCompare(b))
  // Chart unit only. Original currency totals stay separate and unmodified.
  const currency = 'MYR'
  // Preserve chronological ledger ordering and original category-ranking tie order.
  const records = eligible
  const originals = new Map<string,bigint>(), categories = new Map<string,Fraction>(), days = new Map<string,Fraction>()
  let total = fraction(0n)
  for (const row of records) {
    const code = row.expense.currency, minor = BigInt(row.personalSpendingMinor)
    originals.set(code,(originals.get(code) ?? 0n) + minor)
    const rate = code === 'MYR' ? { numerator:'1',denominator:'1' } : fx.rates[code]
    if (!rate) continue
    const amount = estimateMinor(minor,currencyExponent(code),rate)
    total = addFraction(total,amount)
    const category = row.expense.category || 'Other', day = row.expense.occurredOn
    categories.set(category,addFraction(categories.get(category) ?? fraction(0n),amount))
    days.set(day,addFraction(days.get(day) ?? fraction(0n),amount))
  }
  const missingCurrencies = currencies.filter(code => code !== 'MYR' && !fx.rates[code])
  const converted = [...originals].flatMap(([code, minor]): [string,Fraction][] => {
    const rate = code === 'MYR' ? { numerator:'1',denominator:'1' } : fx.rates[code]
    return rate ? [[code,estimateMinor(minor,currencyExponent(code),rate)]] : []
  })
  const equivalents = new Map(reconcileEstimates(converted))
  const totals = (currencies.length ? currencies : [currencyCodes.has(defaultCurrency) ? defaultCurrency : 'MYR']).map(code => ({
    currency:code, originalMinor:(originals.get(code) ?? 0n).toString(), equivalentMinor:equivalents.get(code)?.toString() ?? null,
  }))
  const estimated = roundFraction(total)
  const overflow = estimated > BigInt(Number.MAX_SAFE_INTEGER) || estimated < BigInt(Number.MIN_SAFE_INTEGER)
  const summary = overflow ? summarizeSpending([]) : {
    totalMinor:Number(estimated),
    categories:reconcileEstimates([...categories]).map(([key,n]): [string,number] => [key,Number(n)]).sort((a,b) => b[1]-a[1]),
    days:reconcileEstimates([...days]).map(([key,n]): [string,number] => [key,Number(n)]).sort((a,b) => a[0].localeCompare(b[0])),
  }
  return { ...summary, records, count:records.length, currency, currencies, totals, missingCurrencies, overflow, estimatedMinor:estimated.toString(), fx }
}

export function spendingQuery(filter: SpendingFilter): string {
  return new URLSearchParams({ month: filter.month, scope: filter.scope, tab: filter.tab, ...(filter.fx ? { fx:filter.fx } : {}) }).toString()
}

const colors = ['#E1AD88', '#8FA99E', '#CFC29F', '#B8A29E', '#9DAEB8', '#ADB092']
export function spendingCategoryColor(category: string): string {
  const known = EXPENSE_CATEGORIES.indexOf(category as typeof EXPENSE_CATEGORIES[number])
  const hash = [...category].reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return colors[(known < 0 ? hash : known) % colors.length]
}

export function monthLabel(month: string, lang: 'en' | 'zh', style: 'short' | 'long' = 'short') {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : localeForLang(lang), { year: 'numeric', month: style, timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
}

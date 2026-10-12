import type { PersonalLedgerRow } from './ledgerSummary'
import { isBookedHomeExpense } from './homeView'
import { summarizeSpending } from './insightsModel'
import { CURRENCIES } from './currency'
import { localeForLang } from './locale'
import { EXPENSE_CATEGORIES } from './categories'

export type SpendingScope = 'all' | 'personal' | 'shared'
export type SpendingTab = 'category' | 'trend' | 'ranking'
export type SpendingFilter = { month: string; scope: SpendingScope; currency: string; tab: SpendingTab }
const currencyCodes = new Set(CURRENCIES.map(item => item.code))

export function spendingFilter(params: URLSearchParams, today: string): SpendingFilter {
  const month = params.get('month') ?? ''
  const scope = params.get('scope')
  const tab = params.get('tab')
  const currency = params.get('currency') ?? ''
  return {
    month: /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today.slice(0, 7),
    scope: scope === 'personal' || scope === 'shared' ? scope : 'all',
    currency: currencyCodes.has(currency) ? currency : '',
    tab: tab === 'trend' || tab === 'ranking' ? tab : 'category',
  }
}

/** Derive every visual from ONE complete RLS-loaded ledger, never from the visible page. */
export function spendingSnapshot(rows: readonly PersonalLedgerRow[], participantId: string | null, filter: SpendingFilter, defaultCurrency: string) {
  const eligible = participantId ? rows.filter(row =>
    isBookedHomeExpense(row.expense, participantId)
    && !row.expense.id.startsWith('pending:')
    && row.expense.occurredOn.startsWith(`${filter.month}-`)
    && (filter.scope === 'all' || (filter.scope === 'personal' ? row.expense.scope === 'personal' : row.expense.scope !== 'personal')),
  ) : []
  const currencies = [...new Set(eligible.map(row => row.expense.currency))].sort()
  // An explicit currency remains explicit when a new scope/month has no such records.
  // Never relabel an old amount in a newly selected currency.
  const currency = filter.currency || currencies[0] || (currencyCodes.has(defaultCurrency) ? defaultCurrency : 'MYR')
  const records = eligible.filter(row => row.expense.currency === currency)
    .sort((a, b) => b.expense.occurredOn.localeCompare(a.expense.occurredOn) || b.expense.createdAt.localeCompare(a.expense.createdAt) || a.expense.id.localeCompare(b.expense.id))
  const summary = summarizeSpending(records.map(row => ({
    category: row.expense.category || 'Other', date: row.expense.occurredOn, amountMinor: row.personalSpendingMinor,
  })))
  return { ...summary, records, count: records.length, currency, currencies }
}

export function spendingQuery(filter: SpendingFilter): string {
  return new URLSearchParams({ month: filter.month, scope: filter.scope, currency: filter.currency, tab: filter.tab }).toString()
}

const colors = ['#E1AD88', '#8FA99E', '#CFC29F', '#B8A29E', '#9DAEB8', '#ADB092']
export function spendingCategoryColor(category: string): string {
  const known = EXPENSE_CATEGORIES.indexOf(category as typeof EXPENSE_CATEGORIES[number])
  const hash = [...category].reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return colors[(known < 0 ? hash : known) % colors.length]
}

export function monthLabel(month: string, lang: 'en' | 'zh', style: 'short' | 'long' = 'short') {
  return new Intl.DateTimeFormat(localeForLang(lang), { year: 'numeric', month: style, timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
}

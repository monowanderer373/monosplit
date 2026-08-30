import type { CanonicalExpense } from '../types'

export type MonthlyExpenseSummary = Readonly<{
  currency: string
  month: string
  totalMinor: number
  expenseCount: number
}>

export type CategoryExpenseSummary = Readonly<{
  currency: string
  category: string
  totalMinor: number
  expenseCount: number
}>

export type TripCurrencyRecap = Readonly<{
  currency: string
  totalMinor: number
  expenseCount: number
  monthly: readonly MonthlyExpenseSummary[]
  categories: readonly CategoryExpenseSummary[]
}>

export type TripRecap = Readonly<{
  expenseCount: number
  firstOccurredOn: string | null
  lastOccurredOn: string | null
  currencies: readonly TripCurrencyRecap[]
}>

export type InsightErrorCode = 'invalid_minor_amount' | 'minor_amount_overflow'

export class InsightError extends Error {
  readonly code: InsightErrorCode

  constructor(code: InsightErrorCode) {
    super(code)
    this.name = 'InsightError'
    this.code = code
  }
}

type ActiveExpense = Readonly<{
  currency: string
  category: string
  month: string
  occurredOn: string
  totalMinor: number
}>

function activeExpenses(expenses: readonly CanonicalExpense[]): ActiveExpense[] {
  return expenses
    .filter((expense) => expense.status === 'active')
    .map((expense) => {
      if (!Number.isSafeInteger(expense.totalMinor) || expense.totalMinor < 0) {
        throw new InsightError('invalid_minor_amount')
      }
      return {
        currency: expense.currency.toUpperCase(),
        category: expense.category.trim() || 'Other',
        month: expense.occurredOn.slice(0, 7),
        occurredOn: expense.occurredOn,
        totalMinor: expense.totalMinor,
      }
    })
}

function safeAdd(left: number, right: number): number {
  const sum = left + right
  if (!Number.isSafeInteger(sum)) throw new InsightError('minor_amount_overflow')
  return sum
}

export function summarizeExpensesByMonth(
  expenses: readonly CanonicalExpense[],
): MonthlyExpenseSummary[] {
  const summaries = new Map<string, MonthlyExpenseSummary>()
  for (const expense of activeExpenses(expenses)) {
    const key = `${expense.currency}\u0000${expense.month}`
    const current = summaries.get(key)
    summaries.set(key, {
      currency: expense.currency,
      month: expense.month,
      totalMinor: safeAdd(current?.totalMinor ?? 0, expense.totalMinor),
      expenseCount: (current?.expenseCount ?? 0) + 1,
    })
  }
  return [...summaries.values()].sort((left, right) =>
    left.currency.localeCompare(right.currency) || left.month.localeCompare(right.month),
  )
}

export function summarizeExpensesByCategory(
  expenses: readonly CanonicalExpense[],
): CategoryExpenseSummary[] {
  const summaries = new Map<string, CategoryExpenseSummary>()
  for (const expense of activeExpenses(expenses)) {
    const key = `${expense.currency}\u0000${expense.category}`
    const current = summaries.get(key)
    summaries.set(key, {
      currency: expense.currency,
      category: expense.category,
      totalMinor: safeAdd(current?.totalMinor ?? 0, expense.totalMinor),
      expenseCount: (current?.expenseCount ?? 0) + 1,
    })
  }
  return [...summaries.values()].sort((left, right) =>
    left.currency.localeCompare(right.currency)
    || right.totalMinor - left.totalMinor
    || left.category.localeCompare(right.category),
  )
}

export function buildTripRecap(expenses: readonly CanonicalExpense[]): TripRecap {
  const active = activeExpenses(expenses)
  const monthly = summarizeExpensesByMonth(expenses)
  const categories = summarizeExpensesByCategory(expenses)
  const currencies = [...new Set(active.map((expense) => expense.currency))]
    .sort((left, right) => left.localeCompare(right))
    .map((currency): TripCurrencyRecap => {
      const currencyExpenses = active.filter((expense) => expense.currency === currency)
      return {
        currency,
        totalMinor: currencyExpenses.reduce(
          (sum, expense) => safeAdd(sum, expense.totalMinor),
          0,
        ),
        expenseCount: currencyExpenses.length,
        monthly: monthly.filter((summary) => summary.currency === currency),
        categories: categories.filter((summary) => summary.currency === currency),
      }
    })

  const occurredDates = active.map((expense) => expense.occurredOn).sort()
  return {
    expenseCount: active.length,
    firstOccurredOn: occurredDates[0] ?? null,
    lastOccurredOn: occurredDates.at(-1) ?? null,
    currencies,
  }
}

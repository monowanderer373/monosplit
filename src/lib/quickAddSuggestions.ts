import type { CanonicalExpense } from '../types'
import type { MoneyContextRef } from './moneyContext'

export type QuickAddSuggestion = Readonly<{
  description: string
  category: string
  score: number
}>

const TIME_FALLBACKS = {
  morning: [
    { description: 'Breakfast', category: 'Food' },
    { description: 'Coffee', category: 'Food' },
  ],
  afternoon: [
    { description: 'Lunch', category: 'Food' },
    { description: 'Transport', category: 'Transport' },
  ],
  evening: [
    { description: 'Dinner', category: 'Food' },
    { description: 'Drinks', category: 'Food' },
  ],
} as const

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

function timeBucket(date: Date): keyof typeof TIME_FALLBACKS {
  const hour = date.getHours()
  if (hour < 11) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function isExpenseInContext(
  expense: CanonicalExpense,
  context: MoneyContextRef,
): boolean {
  if (context.kind === 'personal') return expense.scope === 'personal'
  if (context.kind === 'space') {
    return expense.scope === 'space' && expense.spaceId === context.spaceId
  }
  return expense.scope === 'direct'
    && expense.participations.some(
      (participation) =>
        context.participantIds.includes(participation.participantId),
    )
}

function recencyScore(createdAt: string, nowMs: number): number {
  const days = Math.max(
    0,
    Math.floor((nowMs - Date.parse(createdAt)) / 86_400_000),
  )
  if (days <= 1) return 20
  if (days <= 7) return 14
  if (days <= 30) return 8
  return 2
}

export function suggestQuickAddDescriptions(input: {
  expenses: CanonicalExpense[]
  context: MoneyContextRef
  now?: Date
  limit?: number
}): QuickAddSuggestion[] {
  const now = input.now ?? new Date()
  const limit = input.limit ?? 3
  const candidates = new Map<
    string,
    {
      description: string
      categories: Map<string, number>
      frequency: number
      latestAt: string
      contextFrequency: number
      sameTimeFrequency: number
    }
  >()

  for (const expense of input.expenses) {
    if (expense.status !== 'active' || !expense.description?.trim()) continue
    const key = normalize(expense.description)
    const current = candidates.get(key) ?? {
      description: expense.description.trim(),
      categories: new Map<string, number>(),
      frequency: 0,
      latestAt: expense.createdAt,
      contextFrequency: 0,
      sameTimeFrequency: 0,
    }
    current.frequency += 1
    current.latestAt =
      current.latestAt.localeCompare(expense.createdAt) < 0
        ? expense.createdAt
        : current.latestAt
    current.contextFrequency += isExpenseInContext(expense, input.context) ? 1 : 0
    current.sameTimeFrequency +=
      timeBucket(new Date(expense.createdAt)) === timeBucket(now) ? 1 : 0
    current.categories.set(
      expense.category,
      (current.categories.get(expense.category) ?? 0) + 1,
    )
    candidates.set(key, current)
  }

  const ranked = [...candidates.entries()]
    .map(([key, candidate]) => {
      const category = [...candidate.categories.entries()].sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )[0]?.[0] ?? ''
      return {
        key,
        description: candidate.description,
        category,
        score:
          Math.min(candidate.frequency * 3, 15)
          + recencyScore(candidate.latestAt, now.getTime())
          + Math.min(candidate.contextFrequency * 5, 20)
          + Math.min(candidate.sameTimeFrequency * 2, 6),
        latestAt: candidate.latestAt,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score
        || right.latestAt.localeCompare(left.latestAt)
        || left.key.localeCompare(right.key),
    )
    .map(({ description, category, score }) => ({ description, category, score }))

  for (const fallback of TIME_FALLBACKS[timeBucket(now)]) {
    if (!ranked.some((item) => normalize(item.description) === normalize(fallback.description))) {
      ranked.push({ ...fallback, score: 0 })
    }
  }
  return ranked.slice(0, limit)
}

export function suggestCategoryForDescription(input: {
  expenses: CanonicalExpense[]
  context: MoneyContextRef
  description: string
}): string {
  const key = normalize(input.description)
  if (!key) return ''

  const categories = new Map<string, { count: number; contextCount: number; latestAt: string }>()
  for (const expense of input.expenses) {
    if (
      expense.status !== 'active'
      || normalize(expense.description ?? '') !== key
    ) continue
    const current = categories.get(expense.category) ?? {
      count: 0,
      contextCount: 0,
      latestAt: expense.createdAt,
    }
    current.count += 1
    current.contextCount += isExpenseInContext(expense, input.context) ? 1 : 0
    current.latestAt =
      current.latestAt.localeCompare(expense.createdAt) < 0
        ? expense.createdAt
        : current.latestAt
    categories.set(expense.category, current)
  }

  return [...categories.entries()]
    .sort(
      (left, right) =>
        right[1].contextCount - left[1].contextCount
        || right[1].count - left[1].count
        || right[1].latestAt.localeCompare(left[1].latestAt)
        || left[0].localeCompare(right[0]),
    )[0]?.[0] ?? ''
}

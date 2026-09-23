import type { CanonicalExpense } from '../types'
import type { ContextRankSurface, MoneyContextRef } from './moneyContext'

export type ContextActivity = Readonly<{
  context: MoneyContextRef
  occurredAt: string
}>

export type RankedMoneyContext = Readonly<{
  context: MoneyContextRef
  score: number
  lastUsedAt: string | null
  useCount: number
}>

function contextKey(context: MoneyContextRef): string {
  if (context.kind === 'personal') return 'personal'
  if (context.kind === 'person') return `person:${context.personId}`
  return `space:${context.spaceId}`
}

function recencyScore(lastUsedAt: string | null, nowMs: number): number {
  if (!lastUsedAt) return 0
  const ageDays = Math.max(
    0,
    Math.floor((nowMs - Date.parse(lastUsedAt)) / 86_400_000),
  )
  if (ageDays <= 1) return 30
  if (ageDays <= 7) return 22
  if (ageDays <= 30) return 14
  if (ageDays <= 90) return 6
  return 1
}

function destinationBias(
  context: MoneyContextRef,
  destination: ContextRankSurface,
): number {
  if (destination === 'friends' && context.kind === 'person') return 4
  if (destination === 'groups' && context.kind === 'space') return 4
  if (destination === 'daily' && context.kind === 'personal') return 4
  return 0
}

export function rankMoneyContexts(input: {
  contexts: MoneyContextRef[]
  activity: ContextActivity[]
  destination: ContextRankSurface
  nowMs?: number
}): RankedMoneyContext[] {
  const nowMs = input.nowMs ?? Date.now()
  const activityByContext = new Map<string, string[]>()
  for (const item of input.activity) {
    const key = contextKey(item.context)
    const dates = activityByContext.get(key) ?? []
    dates.push(item.occurredAt)
    activityByContext.set(key, dates)
  }

  return input.contexts
    .map((context) => {
      const dates = activityByContext.get(contextKey(context)) ?? []
      const lastUsedAt = dates.sort().at(-1) ?? null
      const useCount = dates.length
      return {
        context,
        lastUsedAt,
        useCount,
        score:
          recencyScore(lastUsedAt, nowMs)
          + Math.min(useCount * 3, 18)
          + destinationBias(context, input.destination),
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      const rightDate = right.lastUsedAt ?? ''
      const leftDate = left.lastUsedAt ?? ''
      if (rightDate !== leftDate) return rightDate.localeCompare(leftDate)
      return contextKey(left.context).localeCompare(contextKey(right.context))
    })
}

export function expenseContextActivity(
  expenses: CanonicalExpense[],
  contexts: MoneyContextRef[],
): ContextActivity[] {
  const people = new Map(
    contexts
      .filter((context) => context.kind === 'person')
      .flatMap((context) =>
        context.participantIds.map(
          (participantId) => [participantId, context] as const,
        ),
      ),
  )
  const spaces = new Map(
    contexts
      .filter((context) => context.kind === 'space')
      .map((context) => [context.spaceId, context]),
  )

  return expenses.flatMap((expense): ContextActivity[] => {
    if (expense.status !== 'active') return []
    if (expense.scope === 'personal') {
      return [{ context: { kind: 'personal' } as const, occurredAt: expense.createdAt }]
    }
    if (expense.scope === 'space' && expense.spaceId) {
      const context = spaces.get(expense.spaceId)
      return context ? [{ context, occurredAt: expense.createdAt }] : []
    }
    const directContexts = expense.participations
      .map((participation) => people.get(participation.participantId))
      .filter(
        (
          context,
        ): context is Extract<MoneyContextRef, { kind: 'person' }> =>
          Boolean(context),
      )
      .filter(
        (context, index, matches) =>
          matches.findIndex(
            (candidate) =>
              candidate.personId === context.personId,
          ) === index,
      )
    return directContexts.map((context) => ({
      context,
      occurredAt: expense.createdAt,
    }))
  })
}

export function matchesContextSearch(
  context: MoneyContextRef,
  query: string,
  labels: Readonly<{ personal: string; person: string; group: string; trip: string }>,
): boolean {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return true

  const name =
    context.kind === 'personal'
      ? labels.personal
      : context.displayName
  const type =
    context.kind === 'personal'
      ? labels.personal
      : context.kind === 'person'
        ? labels.person
        : context.spaceType === 'trip'
          ? labels.trip
          : labels.group
  return `${name} ${type}`.toLocaleLowerCase().includes(normalized)
}

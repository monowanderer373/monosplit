/** Presentation only. Financial positions MUST come from existing authoritative services. */

export type SharedTab = 'friends' | 'groups' | 'trips'
export type SharedFilter = 'all' | 'balances'
export type Position = {
  currency: string
  nonzero: boolean
  display: string
  direction: 'collect' | 'pay'
}
export type AmountView = {
  kind: 'hidden' | 'manual' | 'amount' | 'other' | 'neutral'
  amount: string
  direction: string
  status: string
}

export const normalizeQuery = (q: string): string =>
  String(q).normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()

export function searchNames<T extends { name: string }>(rows: readonly T[], q: string): T[] {
  const query = normalizeQuery(q)
  if (!query) return [...rows]
  return rows.filter((row) => normalizeQuery(row.name).includes(query))
}

export function rowAmountView(input: {
  hidden: boolean
  selectedCurrency: string
  positions: readonly Position[]
  hasConfirmedHistory: boolean
  manual: boolean
  pendingCount?: number
}): AmountView {
  if (input.hidden) return { kind: 'hidden', amount: '', direction: '', status: 'Hidden' }
  if (input.manual) return { kind: 'manual', amount: '', direction: '', status: 'Only you record this' }
  const selected = input.positions.find((position) => position.currency === input.selectedCurrency && position.nonzero)
  if (selected) {
    return {
      kind: 'amount',
      amount: selected.display,
      direction: selected.direction === 'collect' ? 'owes you' : 'you owe',
      status: '',
    }
  }
  if (input.positions.some((position) => position.nonzero)) {
    return { kind: 'other', amount: '', direction: '', status: 'Other currencies' }
  }
  return {
    kind: 'neutral',
    amount: '',
    direction: '',
    status: input.hasConfirmedHistory ? 'Settled up' : input.pendingCount ? 'Pending review' : 'No records yet',
  }
}

export function filterBalances<T extends { manual: boolean; positions: readonly Position[] }>(
  rows: readonly T[],
  enabled: boolean,
): readonly T[] {
  return enabled ? rows.filter((row) => !row.manual && row.positions.some((position) => position.nonzero)) : rows
}

export function collectionEntryLabel(pendingReceipts: number): 'Confirm receipt' | 'Request payment' {
  return pendingReceipts > 0 ? 'Confirm receipt' : 'Request payment'
}

export function uniqueActionableTasks<T extends { kind: string; id: string; actionable: boolean; state: string; version: number }>(
  tasks: readonly T[],
): T[] {
  const result = new Map<string, T>()
  for (const task of tasks) {
    if (!task.actionable || task.state !== 'pending') continue
    const key = `${task.kind}:${task.id}`
    const previous = result.get(key)
    if (!previous || task.version > previous.version) result.set(key, task)
  }
  return [...result.values()]
}

export type Candidate = {
  owner: string
  personId: string
  currency: string
  direction: 'collect' | 'pay'
  context: { scope: 'direct' | 'space' }
  key: string
}

export function exactCandidates<T extends Candidate>(
  items: readonly T[],
  criteria: { owner: string; personId: string; currency: string; direction: 'collect' | 'pay' },
): T[] {
  return items.filter((item) =>
    item.owner === criteria.owner
    && item.personId === criteria.personId
    && item.currency === criteria.currency
    && item.direction === criteria.direction
    && item.context.scope === 'direct',
  )
}

export function candidateResolution(items: readonly unknown[]): 'unavailable' | 'open' | 'choose' {
  return items.length === 0 ? 'unavailable' : items.length === 1 ? 'open' : 'choose'
}

export function collectPayHref(item: { direction: 'collect' | 'pay'; key: string }): string {
  if (!['collect', 'pay'].includes(item.direction) || typeof item.key !== 'string' || !item.key) {
    throw new Error('invalid_target')
  }
  return `/collect-pay/${item.direction}?${new URLSearchParams({ item: item.key })}`
}

export function safeLocalReturn(value: unknown): string {
  try {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
      return '/shared'
    }
    const url = new URL(value, 'https://tabby.invalid')
    if (url.origin !== 'https://tabby.invalid') return '/shared'
    return /^\/(shared|friends|person(?:\/[^/]+)?|spaces|space(?:\/[^/]+)?)(?:$)/.test(url.pathname)
      ? url.pathname + url.search + url.hash
      : '/shared'
  } catch {
    return '/shared'
  }
}

export function compactMeta(input: {
  hidden: boolean
  pendingCount: number
  manual: boolean
  linkPending: boolean
  lastShared?: string
  settled: boolean
}): string {
  if (input.hidden) return ''
  if (input.pendingCount > 0) return `${input.pendingCount} item${input.pendingCount === 1 ? '' : 's'} to review`
  if (input.linkPending) return 'Link pending'
  if (input.manual) return 'Only you record this'
  if (input.lastShared) return `Last shared ${input.lastShared}`
  return input.settled ? 'Settled up' : 'No records yet'
}

export function financialActionsEnabled(input: {
  loadedRevision: string | null
  currentRevision: string
  loading: boolean
  identityMatches: boolean
  online: boolean
}): boolean {
  return !input.loading
    && input.identityMatches
    && input.online
    && Boolean(input.loadedRevision)
    && input.loadedRevision === input.currentRevision
}

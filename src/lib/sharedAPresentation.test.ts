import { describe, expect, it } from 'vitest'
import {
  candidateResolution,
  collectionEntryLabel,
  compactMeta,
  collectPayHref,
  exactCandidates,
  filterBalances,
  financialActionsEnabled,
  normalizeQuery,
  rowAmountView,
  safeLocalReturn,
  searchNames,
  uniqueActionableTasks,
} from './sharedAPresentation'

const pos = { currency: 'MYR', display: 'MYR 50.00', nonzero: true, direction: 'collect' as const }
const base = { hidden: false, selectedCurrency: 'MYR', positions: [pos], hasConfirmedHistory: true, manual: false }
const item = {
  owner: 'u',
  personId: 's',
  currency: 'MYR',
  direction: 'collect' as const,
  context: { scope: 'direct' as const },
  key: '["direct:a:b","b","MYR","collect"]',
}

describe('Shared A presentation contract', () => {
  it('ignores case and excess whitespace in search queries', () => {
    expect(normalizeQuery('  SAM  Lee ')).toBe('sam lee')
  })

  it('keeps distinct same-name identities in partial search', () => {
    expect(searchNames([{ name: 'Sam', id: 1 }, { name: 'Sam', id: 2 }, { name: 'Alex', id: 3 }], 'sa')).toHaveLength(2)
  })

  it('treats no matches as an empty result, not a first-use collection', () => {
    expect(searchNames([{ name: 'Sam' }], 'zz')).toEqual([])
  })

  it('labels a confirmed collect as owes you', () => {
    expect(rowAmountView(base).direction).toBe('owes you')
  })

  it('labels a confirmed pay as you owe', () => {
    expect(rowAmountView({ ...base, positions: [{ ...pos, direction: 'pay' }] }).direction).toBe('you owe')
  })

  it('conceals amount and direction together', () => {
    expect(rowAmountView({ ...base, hidden: true })).toEqual({
      kind: 'hidden',
      amount: '',
      direction: '',
      status: 'Hidden',
    })
  })

  it('never turns a manual person into tracked debt', () => {
    expect(rowAmountView({ ...base, manual: true }).amount).toBe('')
  })

  it('does not report other-currency balances as settled', () => {
    expect(rowAmountView({ ...base, selectedCurrency: 'VND' }).status).toBe('Other currencies')
  })

  it('marks known zero history as settled', () => {
    expect(rowAmountView({ ...base, positions: [] }).status).toBe('Settled up')
  })

  it('does not treat missing history as a settlement', () => {
    expect(rowAmountView({ ...base, positions: [], hasConfirmedHistory: false }).status).toBe('No records yet')
  })

  it('keeps pending review out of confirmed amounts', () => {
    expect(rowAmountView({ ...base, positions: [], hasConfirmedHistory: false, pendingCount: 2 }).status).toBe('Pending review')
  })

  it('filters With balances across currencies without summing them', () => {
    expect(filterBalances([
      { manual: false, positions: [{ ...pos, currency: 'VND' }] },
      { manual: false, positions: [] },
    ], true)).toHaveLength(1)
  })

  it('excludes manual people from With balances', () => {
    expect(filterBalances([{ manual: true, positions: [pos] }], true)).toHaveLength(0)
  })

  it('returns the original rows when the All filter is on', () => {
    const rows: Array<{ manual: boolean; positions: typeof pos[] }> = []
    expect(filterBalances(rows, false)).toBe(rows)
  })

  it('uses Request payment when no incoming receipt exists', () => {
    expect(collectionEntryLabel(0)).toBe('Request payment')
  })

  it('uses Confirm receipt when a pending payment exists', () => {
    expect(collectionEntryLabel(1)).toBe('Confirm receipt')
  })

  it('drops waiting and completed review tasks and keeps the newest duplicate', () => {
    const tasks = [
      { kind: 'expense', id: 'a', actionable: true, state: 'pending', version: 1 },
      { kind: 'expense', id: 'a', actionable: true, state: 'pending', version: 2 },
      { kind: 'request', id: 'b', actionable: false, state: 'pending', version: 1 },
      { kind: 'payment', id: 'c', actionable: true, state: 'accepted', version: 1 },
    ]
    expect(uniqueActionableTasks(tasks).map((task) => task.version)).toEqual([2])
  })

  it('isolates collect-pay candidates by owner, person, currency, direction and direct context', () => {
    const items = [
      item,
      { ...item, owner: 'x' },
      { ...item, personId: 'x' },
      { ...item, currency: 'VND' },
      { ...item, direction: 'pay' as const },
      { ...item, context: { scope: 'space' as const } },
    ]
    expect(exactCandidates(items, item)).toEqual([item])
  })

  it('resolves zero, one and many collect-pay candidates', () => {
    expect(candidateResolution([])).toBe('unavailable')
    expect(candidateResolution([item])).toBe('open')
    expect(candidateResolution([item, item])).toBe('choose')
  })

  it('round-trips the opaque collect-pay item key through the URL', () => {
    expect(new URL(collectPayHref(item), 'https://a.test').searchParams.get('item')).toBe(item.key)
  })

  it('rejects an invalid collect-pay direction', () => {
    expect(() => collectPayHref({ ...item, direction: 'receive' as 'collect' })).toThrow()
  })

  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/login', 'javascript:alert(1)'])(
    'rejects unsafe return path %s',
    (target) => {
      expect(safeLocalReturn(target)).toBe('/shared')
    },
  )

  it('keeps shared origin filters on a local return path', () => {
    expect(safeLocalReturn('/shared?tab=trips#row')).toBe('/shared?tab=trips#row')
  })

  it('lets pending review meta outrank the last shared date', () => {
    expect(compactMeta({
      hidden: false,
      pendingCount: 1,
      manual: false,
      linkPending: false,
      lastShared: '15 Oct',
      settled: false,
    })).toBe('1 item to review')
  })

  it('hides directional meta when amounts are concealed', () => {
    expect(compactMeta({
      hidden: true,
      pendingCount: 1,
      manual: false,
      linkPending: false,
      settled: false,
    })).toBe('')
  })

  it('enables financial actions only on the current loaded authority', () => {
    const ready = {
      loadedRevision: 'r1',
      currentRevision: 'r1',
      loading: false,
      identityMatches: true,
      online: true,
    }
    expect(financialActionsEnabled(ready)).toBe(true)
    for (const patch of [
      { loadedRevision: null },
      { currentRevision: 'r2' },
      { loading: true },
      { identityMatches: false },
      { online: false },
    ]) {
      expect(financialActionsEnabled({ ...ready, ...patch })).toBe(false)
    }
  })
})

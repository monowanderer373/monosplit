import { describe, expect, it } from 'vitest'
import type { CanonicalExpense, PersonRelationship } from '../types'
import { collectionActionCopy, confirmedPositionsFromDebtLines, pendingCountForPerson, resolvePersonCollectPay } from './sharedAListModel'
import type { CollectPayItem } from './collectPay'
import type { HomeNotification } from './homeNotifications'
import type { RelationalDebtLine } from './relationalBalance'

function person(overrides: Partial<PersonRelationship> = {}): PersonRelationship {
  return {
    id: 'person-sam',
    ownerParticipantId: 'owner',
    displayName: 'Sam',
    linkedParticipantId: 'sam',
    mergedIntoPersonId: null,
    manualParticipantIds: [],
    primaryManualParticipantId: null,
    state: 'linked',
    friendshipStatus: 'accepted',
    ...overrides,
  }
}

const collectLine: RelationalDebtLine = {
  debtorParticipantId: 'sam',
  creditorParticipantId: 'owner',
  currency: 'MYR',
  remainingMinor: 5000,
}

const item = {
  key: '["direct","sam","MYR","collect"]',
  context: { scope: 'direct', participantIds: ['owner', 'sam'] as const },
  source: 'friend',
  label: '',
  otherId: 'sam',
  otherName: 'Sam',
  personId: 'person-sam',
  currency: 'MYR',
  direction: 'collect',
  remainingMinor: 5000,
  originalNetMinor: 5000,
  confirmedNetMinor: 0,
  expenses: [] as CanonicalExpense[],
  payments: [],
  balancePayments: [],
  requests: [],
  canPay: true,
} as CollectPayItem

describe('Shared A list model', () => {
  it('maps a remaining collect line to a quiet MYR display without inventing FX', () => {
    const positions = confirmedPositionsFromDebtLines('owner', 'sam', [collectLine, {
      ...collectLine,
      currency: 'VND',
      remainingMinor: 2400,
    }])
    expect(positions.map((position) => position.currency)).toEqual(['MYR', 'VND'])
    expect(positions[0]?.direction).toBe('collect')
    expect(positions[0]?.display).toContain('50.00')
  })

  it('never invents tracked positions for a manual person', () => {
    expect(confirmedPositionsFromDebtLines('owner', person({
      linkedParticipantId: null,
      state: 'manual',
      friendshipStatus: null,
    }).linkedParticipantId, [collectLine])).toEqual([])
  })

  it('opens the unique collect-pay item key and does not default the first of many', () => {
    const second = { ...item, key: '["direct","sam","MYR","collect-2"]', currency: 'MYR' }
    expect(resolvePersonCollectPay({
      owner: 'owner',
      personId: 'person-sam',
      currency: 'MYR',
      direction: 'collect',
      items: [item],
    })).toEqual({
      resolution: 'open',
      href: `/collect-pay/collect?${new URLSearchParams({ item: item.key })}`,
      candidates: [item],
    })
    expect(resolvePersonCollectPay({
      owner: 'owner',
      personId: 'person-sam',
      currency: 'MYR',
      direction: 'collect',
      items: [item, second],
    }).resolution).toBe('choose')
    expect(resolvePersonCollectPay({
      owner: 'owner',
      personId: 'missing',
      currency: 'MYR',
      direction: 'collect',
      items: [item],
    }).resolution).toBe('unavailable')
  })

  it('labels collection without a pending receipt as a request, not received cash', () => {
    expect(collectionActionCopy('owner', item)).toBe('Request payment')
    const pending = {
      ...item,
      payments: [{
        id: 'pay',
        scope: 'direct' as const,
        spaceId: null,
        debtorParticipantId: 'sam',
        currency: 'MYR',
        status: 'pending' as const,
        paymentDate: '2026-10-01',
        createdAt: '',
        updatedAt: '',
        note: null,
        version: 1,
        allocations: [{
          creditorParticipantId: 'owner',
          amountMinor: 5000,
          state: 'pending' as const,
        }],
      }],
    } as CollectPayItem
    expect(collectionActionCopy('owner', pending)).toBe('Confirm receipt')
  })

  it('counts pending review by participant id, not display name', () => {
    const notices = [{
      id: 'expense:exp-1',
      ref: { kind: 'expense' as const, id: 'exp-1' },
      intent: 'review-expense' as const,
      source: 'shared-ledger' as const,
      version: '1',
      tab: 'tasks' as const,
      state: 'pending' as const,
      title: 'notice.expense' as const,
      action: 'notice.review' as const,
      description: '',
      date: '2026-10-01',
      scope: { kind: 'direct' as const, spaceId: null },
      contextLabel: 'Sam',
    }]
    const sameNameOther = person({ id: 'person-other', linkedParticipantId: 'other', displayName: 'Sam' })
    const expense: CanonicalExpense = {
      id: 'exp-1',
      clientRequestId: 'exp-1',
      scope: 'direct',
      spaceId: null,
      createdBy: 'owner',
      totalMinor: 100,
      participantCount: 2,
      currency: 'MYR',
      description: 'Lunch',
      category: 'Food',
      occurredOn: '2026-10-01',
      status: 'active',
      version: 1,
      correctsExpenseId: null,
      terminationKind: null,
      voidedAt: null,
      createdAt: '',
      updatedAt: '',
      participations: [
        { id: 'a', expenseId: 'exp-1', participantId: 'owner', nameSnapshot: 'Me', order: 0, state: 'pending', trackingMode: 'tracked' },
        { id: 'b', expenseId: 'exp-1', participantId: 'sam', nameSnapshot: 'Sam', order: 1, state: 'accepted', trackingMode: 'tracked' },
      ],
      payerContributions: [],
      shares: [],
    }
    expect(pendingCountForPerson(person(), 'owner', [expense], notices as HomeNotification[])).toBe(1)
    expect(pendingCountForPerson(sameNameOther, 'owner', [expense], notices as HomeNotification[])).toBe(0)
  })
})

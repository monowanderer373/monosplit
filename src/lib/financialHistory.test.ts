import { describe, expect, it } from 'vitest'
import type { CanonicalExpense } from '../types'
import type { DirectExpenseChangeRequest } from './expenseChangeRepository'
import {
  deriveExpenseRevisionEntries,
  deriveSettlementHistoryEntries,
  FinancialHistoryError,
} from './financialHistory'
import {
  deriveSettlementAttributions,
  type BalanceContext,
} from './relationalBalance'
import type { SettlementPayment } from './settlementRepository'

const context: BalanceContext = {
  scope: 'direct',
  participantIds: ['debtor', 'creditor'],
}

describe('expense audit history', () => {
  it('shows A corrected by B and B as correction/current', () => {
    const a = directExpense('a', 10_000, {
      status: 'voided',
      terminationKind: 'corrected',
    })
    const b = directExpense('b', 8_000, { correctsExpenseId: 'a' })

    expect(deriveExpenseRevisionEntries([a, b], [authority(a, b)])).toMatchObject([
      {
        expense: { id: 'a' },
        role: 'original',
        nextExpenseId: 'b',
        isCurrent: false,
      },
      {
        expense: { id: 'b' },
        role: 'correction',
        previousExpenseId: 'a',
        isCurrent: true,
      },
    ])
  })

  it('shows only C current in A to B to C', () => {
    const a = directExpense('a', 10_000, {
      status: 'voided',
      terminationKind: 'corrected',
    })
    const b = directExpense('b', 8_000, {
      status: 'voided',
      terminationKind: 'corrected',
      correctsExpenseId: 'a',
    })
    const c = directExpense('c', 7_000, { correctsExpenseId: 'b' })
    const entries = deriveExpenseRevisionEntries(
      [a, b, c],
      [authority(a, b), authority(b, c)],
    )

    expect(entries.filter((entry) => entry.isCurrent).map((entry) => entry.expense.id))
      .toEqual(['c'])
    expect(entries.map((entry) => [entry.expense.id, entry.role])).toEqual([
      ['a', 'original'],
      ['b', 'correction'],
      ['c', 'correction'],
    ])
  })

  it('keeps pending, declined, and withdrawn candidates out of lineage', () => {
    const a = directExpense('a', 10_000)
    const candidate = directExpense('candidate', 8_000, {
      status: 'correction_pending',
    })
    for (const state of ['pending', 'declined', 'cancelled'] as const) {
      const stateCandidate = {
        ...candidate,
        status: state === 'pending' ? 'correction_pending' : 'voided',
      } as CanonicalExpense
      const request = {
        ...authority(a, stateCandidate),
        state,
      }
      const entries = deriveExpenseRevisionEntries([a, stateCandidate], [request])
      expect(entries.find((entry) => entry.expense.id === 'a')?.isCurrent).toBe(true)
      expect(entries.find((entry) => entry.expense.id === 'candidate')).toMatchObject({
        role: 'standalone',
        lifecycle: 'proposal_candidate',
        isCurrent: false,
      })
    }
  })

  it('distinguishes cancellation, correction, and legacy voiding', () => {
    const corrected = directExpense('corrected', 100, {
      status: 'voided',
      terminationKind: 'corrected',
    })
    const cancelled = directExpense('cancelled', 100, {
      status: 'voided',
      terminationKind: 'cancelled',
    })
    const legacy = directExpense('legacy', 100, { status: 'voided' })
    expect(deriveExpenseRevisionEntries(
      [corrected, cancelled, legacy],
      [],
    ).map((entry) => entry.lifecycle)).toEqual([
      'corrected',
      'cancelled',
      'legacy_voided',
    ])
  })

  it('preserves historical Manual Participant identity', () => {
    const manualId = 'manual-original-uuid'
    const historical = directExpense('historical', 100, {
      participations: [
        participation('historical-owner', 'owner', 'accepted', 'tracked', 0),
        participation('historical-manual', manualId, 'untracked', 'untracked', 1),
      ],
    })
    const [entry] = deriveExpenseRevisionEntries([historical], [])
    expect(entry.expense.participations[1].participantId).toBe(manualId)
  })

  it('uses a privacy-safe partial link when a replacement is not visible', () => {
    const visibleTarget = directExpense('visible', 100, {
      status: 'voided',
      terminationKind: 'corrected',
    })
    const hiddenReplacement = directExpense('hidden', 100)
    const [entry] = deriveExpenseRevisionEntries(
      [visibleTarget],
      [authority(visibleTarget, hiddenReplacement)],
    )
    expect(entry).toMatchObject({
      nextExpenseId: 'hidden',
      nextVisible: false,
      isCurrent: false,
    })
  })

  it('fails closed for authoritative lineage without matching authority', () => {
    const a = directExpense('a', 100, {
      status: 'voided',
      terminationKind: 'corrected',
    })
    const b = directExpense('b', 100, { correctsExpenseId: 'a' })
    expect(() => deriveExpenseRevisionEntries([a, b], []))
      .toThrow(FinancialHistoryError)
  })
})

describe('settlement audit history', () => {
  it('keeps accepted settlement and reversal as separate facts', () => {
    const payment = settlement('accepted', 10_000, {
      reversalMinor: 10_000,
    })
    const [entry] = deriveSettlementHistoryEntries([payment], [])
    expect(entry.facts.map((fact) => [fact.kind, fact.amountMinor])).toEqual([
      ['accepted', 10_000],
      ['reversed', 10_000],
    ])
  })

  it('does not present pending cancellation as reversal', () => {
    const [entry] = deriveSettlementHistoryEntries([
      settlement('cancelled', 10_000),
    ], [])
    expect(entry.facts.map((fact) => fact.kind)).toEqual(['proposal_cancelled'])
  })

  it('keeps RM100 historical while current derivation shows RM80 applied and RM20 credit', () => {
    const effectiveExpense = obligation('effective-80', 8_000)
    const payment = settlement('accepted', 10_000)
    const attribution = deriveSettlementAttributions(
      [effectiveExpense],
      [payment],
      context,
    )
    const [entry] = deriveSettlementHistoryEntries([payment], attribution)

    expect(entry.facts[0]).toMatchObject({ kind: 'accepted', amountMinor: 10_000 })
    expect(entry.currentAppliedMinor).toBe(8_000)
    expect(entry.currentCreditMinor).toBe(2_000)
  })

  it('updates current derivation without rewriting the accepted fact', () => {
    const payment = settlement('accepted', 10_000)
    const first = deriveSettlementHistoryEntries(
      [payment],
      deriveSettlementAttributions([obligation('expense-80', 8_000)], [payment], context),
    )[0]
    const later = deriveSettlementHistoryEntries(
      [payment],
      deriveSettlementAttributions([
        obligation('expense-80', 8_000),
        obligation('expense-15', 1_500),
      ], [payment], context),
    )[0]

    expect(first.facts).toEqual(later.facts)
    expect(first.currentCreditMinor).toBe(2_000)
    expect(later.currentCreditMinor).toBe(500)
  })

  it('renders legacy reversed state compatibly and rejects invalid reversal facts', () => {
    const legacy = settlement('reversed', 10_000)
    expect(deriveSettlementHistoryEntries([legacy], [])[0].facts.map(
      (fact) => fact.kind,
    )).toEqual(['accepted', 'legacy_reversed'])
    expect(() => deriveSettlementHistoryEntries([
      settlement('accepted', 10_000, { reversalMinor: 10_001 }),
    ], [])).toThrow(FinancialHistoryError)
  })
})

function directExpense(
  id: string,
  totalMinor: number,
  overrides: Partial<CanonicalExpense> = {},
): CanonicalExpense {
  return {
    id,
    clientRequestId: `request-${id}`,
    scope: 'direct',
    spaceId: null,
    createdBy: 'owner',
    totalMinor,
    participantCount: 2,
    currency: 'MYR',
    description: id.toUpperCase(),
    category: 'Other',
    occurredOn: '2026-09-08',
    status: 'active',
    version: 1,
    correctsExpenseId: null,
    terminationKind: null,
    voidedAt: null,
    createdAt: `2026-09-08T10:00:0${id.length}Z`,
    updatedAt: `2026-09-08T10:00:0${id.length}Z`,
    participations: [
      participation(`${id}-owner`, 'owner', 'accepted', 'tracked', 0),
      participation(`${id}-counterpart`, 'counterpart', 'accepted', 'tracked', 1),
    ],
    payerContributions: [],
    shares: [],
    ...overrides,
  }
}

function participation(
  id: string,
  participantId: string,
  state: 'pending' | 'accepted' | 'declined' | 'untracked',
  trackingMode: 'tracked' | 'untracked',
  order: number,
) {
  return {
    id,
    expenseId: id.split('-')[0],
    participantId,
    nameSnapshot: participantId,
    order,
    state,
    trackingMode,
  } as const
}

function authority(
  target: CanonicalExpense,
  replacement: CanonicalExpense,
): DirectExpenseChangeRequest {
  return {
    id: `authority-${target.id}`,
    clientRequestId: `authority-request-${target.id}`,
    kind: 'correction',
    state: 'authoritative',
    proposedBy: 'owner',
    targetExpenseId: target.id,
    replacementExpenseId: replacement.id,
    targetVersion: target.version,
    version: 2,
    reason: null,
    createdAt: '2026-09-08T10:00:00Z',
    updatedAt: '2026-09-08T11:00:00Z',
    approvals: [],
  }
}

function settlement(
  state: SettlementPayment['allocations'][number]['state'],
  amountMinor: number,
  overrides: Partial<SettlementPayment['allocations'][number]> = {},
): SettlementPayment {
  return {
    id: 'settlement-1',
    clientRequestId: 'settlement-request-1',
    scope: 'direct',
    spaceId: null,
    debtorParticipantId: 'debtor',
    currency: 'MYR',
    amountMinor,
    paymentDate: '2026-09-08',
    status: state === 'accepted' ? 'confirmed' : state,
    version: 1,
    note: null,
    reversedAt: state === 'reversed' ? '2026-09-08T12:00:00Z' : null,
    reversedBy: state === 'reversed' ? 'creditor' : null,
    createdAt: '2026-09-08T10:00:00Z',
    updatedAt: '2026-09-08T12:00:00Z',
    allocations: [{
      id: 'allocation-1',
      settlementPaymentId: 'settlement-1',
      creditorParticipantId: 'creditor',
      amountMinor,
      state,
      reversalMinor: 0,
      respondedAt: state === 'pending' ? null : '2026-09-08T11:00:00Z',
      createdAt: '2026-09-08T10:00:00Z',
      ...overrides,
    }],
  }
}

function obligation(id: string, amountMinor: number): CanonicalExpense {
  const expense = directExpense(id, amountMinor, {
    createdBy: 'creditor',
    participations: [
      participation(`${id}-creditor`, 'creditor', 'accepted', 'tracked', 0),
      participation(`${id}-debtor`, 'debtor', 'accepted', 'tracked', 1),
    ],
  })
  expense.payerContributions = [{
    expenseParticipationId: `${id}-creditor`,
    expenseId: id,
    amountMinor,
  }]
  expense.shares = [
    {
      expenseParticipationId: `${id}-creditor`,
      expenseId: id,
      amountMinor: 0,
    },
    {
      expenseParticipationId: `${id}-debtor`,
      expenseId: id,
      amountMinor,
    },
  ]
  return expense
}

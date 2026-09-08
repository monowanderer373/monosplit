import { describe, expect, it } from 'vitest'
import type { CanonicalExpense } from '../types'
import {
  deriveRelationalDebtLines,
  deriveSettlementAttributions,
  deriveSignedRelationalPositions,
  summarizeRelationalBalances,
  type BalanceContext,
  type ConfirmedSettlement,
} from './relationalBalance'

type ParticipantAmounts = readonly [
  participantId: string,
  contributionMinor: number,
  shareMinor: number,
]

const DIRECT_CONTEXT: BalanceContext = {
  scope: 'direct',
  participantIds: ['debtor', 'creditor'],
}

function expense(input: {
  id: string
  amounts: readonly ParticipantAmounts[]
  scope?: 'direct' | 'space'
  spaceId?: string | null
  currency?: string
  occurredOn?: string
  acceptedParticipantIds?: readonly string[]
}): CanonicalExpense {
  const scope = input.scope ?? 'direct'
  const acceptedIds = new Set(
    input.acceptedParticipantIds ?? input.amounts.map(([participantId]) => participantId),
  )
  const participations = input.amounts.map(([participantId], order) => ({
    id: `${input.id}-participation-${participantId}`,
    expenseId: input.id,
    participantId,
    nameSnapshot: participantId,
    order,
    state: scope === 'space' || acceptedIds.has(participantId)
      ? 'accepted' as const
      : 'pending' as const,
    trackingMode: 'tracked' as const,
  }))
  const totalMinor = input.amounts.reduce((total, [, contributionMinor]) => (
    total + contributionMinor
  ), 0)
  return {
    id: input.id,
    clientRequestId: `request-${input.id}`,
    scope,
    spaceId: scope === 'space' ? (input.spaceId ?? 'space-1') : null,
    createdBy: input.amounts[0]?.[0] ?? 'creator',
    totalMinor,
    participantCount: participations.length,
    currency: input.currency ?? 'MYR',
    description: input.id,
    category: 'Other',
    occurredOn: input.occurredOn ?? '2026-08-30',
    status: 'active',
    version: 1,
    correctsExpenseId: null,
    terminationKind: null,
    voidedAt: null,
    createdAt: `${input.occurredOn ?? '2026-08-30'}T10:00:00.000Z`,
    updatedAt: `${input.occurredOn ?? '2026-08-30'}T10:00:00.000Z`,
    participations,
    payerContributions: input.amounts
      .filter(([, contributionMinor]) => contributionMinor > 0)
      .map(([participantId, contributionMinor]) => ({
        expenseParticipationId: `${input.id}-participation-${participantId}`,
        expenseId: input.id,
        amountMinor: contributionMinor,
      })),
    shares: input.amounts.map(([participantId, , shareMinor]) => ({
      expenseParticipationId: `${input.id}-participation-${participantId}`,
      expenseId: input.id,
      amountMinor: shareMinor,
    })),
  }
}

function obligation(
  id: string,
  debtorParticipantId: string,
  creditorParticipantId: string,
  amountMinor: number,
  options: {
    scope?: 'direct' | 'space'
    spaceId?: string | null
    currency?: string
    occurredOn?: string
  } = {},
): CanonicalExpense {
  return expense({
    id,
    amounts: [
      [creditorParticipantId, amountMinor, 0],
      [debtorParticipantId, 0, amountMinor],
    ],
    ...options,
  })
}

function settlement(input: {
  id: string
  amountMinor: number
  debtorParticipantId?: string
  creditorParticipantId?: string
  state?: 'pending' | 'accepted' | 'declined' | 'reversed'
  scope?: 'direct' | 'space'
  spaceId?: string | null
  currency?: string
  paymentDate?: string
}): ConfirmedSettlement {
  const scope = input.scope ?? 'direct'
  const state = input.state ?? 'accepted'
  return {
    id: input.id,
    scope,
    spaceId: scope === 'space' ? (input.spaceId ?? 'space-1') : null,
    debtorParticipantId: input.debtorParticipantId ?? 'debtor',
    currency: input.currency ?? 'MYR',
    status: state === 'reversed' ? 'reversed' : 'confirmed',
    paymentDate: input.paymentDate ?? '2026-08-31',
    createdAt: `${input.paymentDate ?? '2026-08-31'}T10:00:00.000Z`,
    allocations: [{
      id: `${input.id}-allocation`,
      creditorParticipantId: input.creditorParticipantId ?? 'creditor',
      amountMinor: input.amountMinor,
      state,
    }],
  }
}

function onlyPosition(
  expenses: readonly CanonicalExpense[],
  settlements: readonly ConfirmedSettlement[],
  context: BalanceContext = DIRECT_CONTEXT,
) {
  const positions = deriveSignedRelationalPositions(expenses, settlements, context)
  expect(positions).toHaveLength(1)
  return positions[0]!
}

describe('signed relational accounting', () => {
  it('A: turns settlement excess into reverse-direction credit', () => {
    const position = onlyPosition(
      [obligation('expense-80', 'debtor', 'creditor', 8_000)],
      [settlement({ id: 'settlement-100', amountMinor: 10_000 })],
    )

    expect(position).toMatchObject({
      expenseSignedMinor: -8_000,
      settlementSignedMinor: -10_000,
      reversalSignedMinor: 0,
      finalSignedMinor: 2_000,
    })
    expect(deriveRelationalDebtLines(
      [obligation('expense-80', 'debtor', 'creditor', 8_000)],
      [settlement({ id: 'settlement-100', amountMinor: 10_000 })],
      DIRECT_CONTEXT,
    )).toEqual([{
      debtorParticipantId: 'creditor',
      creditorParticipantId: 'debtor',
      currency: 'MYR',
      remainingMinor: 2_000,
    }])
  })

  it('B: leaves the original direction when settlement is below the effective obligation', () => {
    expect(onlyPosition(
      [obligation('expense-80', 'debtor', 'creditor', 8_000)],
      [settlement({ id: 'settlement-40', amountMinor: 4_000 })],
    ).finalSignedMinor).toBe(-4_000)
  })

  it('C: leaves the original direction when the effective obligation later exceeds settlement', () => {
    expect(onlyPosition(
      [obligation('expense-120', 'debtor', 'creditor', 12_000)],
      [settlement({ id: 'settlement-100', amountMinor: 10_000 })],
    ).finalSignedMinor).toBe(-2_000)
  })

  it('D: sums effective expenses before subtracting the whole transfer', () => {
    const positions = deriveSignedRelationalPositions(
      [
        obligation('expense-a-revised', 'debtor', 'creditor', 3_000),
        obligation('expense-b', 'debtor', 'creditor', 4_000),
      ],
      [settlement({ id: 'settlement-70', amountMinor: 7_000 })],
      DIRECT_CONTEXT,
    )

    expect(positions[0]).toMatchObject({
      expenseSignedMinor: -7_000,
      settlementSignedMinor: -7_000,
      finalSignedMinor: 0,
    })
    expect(deriveRelationalDebtLines(
      [
        obligation('expense-a-revised', 'debtor', 'creditor', 3_000),
        obligation('expense-b', 'debtor', 'creditor', 4_000),
      ],
      [settlement({ id: 'settlement-70', amountMinor: 7_000 })],
      DIRECT_CONTEXT,
    )).toEqual([])
  })

  it('E: keeps F independent from settlement FIFO attribution order', () => {
    const expenses = [
      obligation('expense-a', 'debtor', 'creditor', 3_000, { occurredOn: '2026-08-01' }),
      obligation('expense-b', 'debtor', 'creditor', 4_000, { occurredOn: '2026-08-02' }),
    ]
    const fiftyFirst = [
      settlement({ id: 'settlement-50', amountMinor: 5_000, paymentDate: '2026-08-03' }),
      settlement({ id: 'settlement-30', amountMinor: 3_000, paymentDate: '2026-08-04' }),
    ]
    const thirtyFirst = [
      settlement({ id: 'settlement-50', amountMinor: 5_000, paymentDate: '2026-08-04' }),
      settlement({ id: 'settlement-30', amountMinor: 3_000, paymentDate: '2026-08-03' }),
    ]

    expect(onlyPosition(expenses, fiftyFirst).finalSignedMinor).toBe(1_000)
    expect(onlyPosition(expenses, thirtyFirst).finalSignedMinor).toBe(1_000)
    expect(deriveSettlementAttributions(expenses, fiftyFirst, DIRECT_CONTEXT)
      .map(({ settlementId, residualMinor }) => [settlementId, residualMinor])).toEqual([
      ['settlement-50', 0],
      ['settlement-30', 1_000],
    ])
    expect(deriveSettlementAttributions(expenses, thirtyFirst, DIRECT_CONTEXT)
      .map(({ settlementId, residualMinor }) => [settlementId, residualMinor])).toEqual([
      ['settlement-30', 0],
      ['settlement-50', 1_000],
    ])
  })

  it('F: interprets a legacy reversed allocation as T plus equal R', () => {
    expect(onlyPosition(
      [obligation('expense-100', 'debtor', 'creditor', 10_000)],
      [settlement({ id: 'legacy-reversed', amountMinor: 10_000, state: 'reversed' })],
    )).toMatchObject({
      expenseSignedMinor: -10_000,
      settlementSignedMinor: -10_000,
      reversalSignedMinor: -10_000,
      finalSignedMinor: -10_000,
    })
  })

  it('interprets an immutable accepted allocation plus reversal fact as T plus R', () => {
    const reversed = settlement({
      id: 'immutable-accepted-reversal',
      amountMinor: 10_000,
      state: 'accepted',
    })
    reversed.allocations[0].reversalMinor = 10_000

    expect(onlyPosition(
      [obligation('expense-100', 'debtor', 'creditor', 10_000)],
      [reversed],
    )).toMatchObject({
      expenseSignedMinor: -10_000,
      settlementSignedMinor: -10_000,
      reversalSignedMinor: -10_000,
      finalSignedMinor: -10_000,
    })
  })

  it('G: normalizes opposing expense obligations into one signed position', () => {
    expect(onlyPosition([
      obligation('forward', 'debtor', 'creditor', 10_000),
      obligation('contra', 'creditor', 'debtor', 3_000),
    ], [])).toMatchObject({
      expenseSignedMinor: -7_000,
      finalSignedMinor: -7_000,
    })
  })

  it('H: maps both canonical UUID orientations deterministically', () => {
    expect(onlyPosition(
      [obligation('low-owes-high', 'a', 'z', 1_000)],
      [],
      { scope: 'direct', participantIds: ['a', 'z'] },
    ).finalSignedMinor).toBe(1_000)
    expect(onlyPosition(
      [obligation('high-owes-low', 'z', 'a', 1_000)],
      [],
      { scope: 'direct', participantIds: ['a', 'z'] },
    ).finalSignedMinor).toBe(-1_000)
  })

  it('I: never crosses Direct and Space contexts', () => {
    const directExpense = obligation('direct', 'debtor', 'creditor', 10_000)
    const spaceExpense = obligation('space', 'debtor', 'creditor', 3_000, {
      scope: 'space',
      spaceId: 'space-1',
    })
    const spaceSettlement = settlement({
      id: 'space-transfer',
      amountMinor: 2_000,
      scope: 'space',
      spaceId: 'space-1',
    })

    expect(onlyPosition(
      [directExpense, spaceExpense],
      [spaceSettlement],
      DIRECT_CONTEXT,
    ).finalSignedMinor).toBe(-10_000)
    expect(onlyPosition(
      [directExpense, spaceExpense],
      [spaceSettlement],
      { scope: 'space', spaceId: 'space-1' },
    ).finalSignedMinor).toBe(-1_000)
  })

  it('J: never cross-nets currencies', () => {
    const lines = deriveRelationalDebtLines(
      [obligation('myr-expense', 'debtor', 'creditor', 10_000)],
      [settlement({ id: 'usd-transfer', amountMinor: 10_000, currency: 'USD' })],
      DIRECT_CONTEXT,
    )

    expect(lines).toEqual([
      {
        debtorParticipantId: 'debtor',
        creditorParticipantId: 'creditor',
        currency: 'MYR',
        remainingMinor: 10_000,
      },
      {
        debtorParticipantId: 'creditor',
        creditorParticipantId: 'debtor',
        currency: 'USD',
        remainingMinor: 10_000,
      },
    ])
  })

  it('K: uses stored participant order for deterministic multi-party pairization', () => {
    const firstOrder = expense({
      id: 'ordered',
      scope: 'space',
      amounts: [
        ['debtor-a', 0, 5_000],
        ['debtor-b', 0, 5_000],
        ['creditor-a', 5_000, 0],
        ['creditor-b', 5_000, 0],
      ],
    })
    const secondOrder = expense({
      id: 'reordered',
      scope: 'space',
      amounts: [
        ['debtor-b', 0, 5_000],
        ['debtor-a', 0, 5_000],
        ['creditor-a', 5_000, 0],
        ['creditor-b', 5_000, 0],
      ],
    })

    expect(deriveRelationalDebtLines(
      [firstOrder],
      [],
      { scope: 'space', spaceId: 'space-1' },
    )).toEqual([
      expect.objectContaining({ debtorParticipantId: 'debtor-a', creditorParticipantId: 'creditor-a' }),
      expect.objectContaining({ debtorParticipantId: 'debtor-b', creditorParticipantId: 'creditor-b' }),
    ])
    expect(deriveRelationalDebtLines(
      [secondOrder],
      [],
      { scope: 'space', spaceId: 'space-1' },
    )).toEqual([
      expect.objectContaining({ debtorParticipantId: 'debtor-b', creditorParticipantId: 'creditor-a' }),
      expect.objectContaining({ debtorParticipantId: 'debtor-a', creditorParticipantId: 'creditor-b' }),
    ])
  })

  it('preserves pending and manual Participant principal boundaries', () => {
    const direct = expense({
      id: 'mixed-direct',
      amounts: [
        ['debtor', 0, 5_000],
        ['creditor', 5_000, 0],
        ['pending-account', 0, 0],
        ['historical-manual', 0, 0],
      ],
      acceptedParticipantIds: ['debtor'],
    })
    direct.participations[3]!.state = 'untracked'
    direct.participations[3]!.trackingMode = 'untracked'

    expect(deriveRelationalDebtLines([direct], [], DIRECT_CONTEXT)).toEqual([])
    expect(direct.participations[3]!.participantId).toBe('historical-manual')
  })

  it('summarizes normalized debt lines without Person mapping', () => {
    expect(summarizeRelationalBalances([{
      debtorParticipantId: 'debtor',
      creditorParticipantId: 'creditor',
      currency: 'MYR',
      remainingMinor: 2_000,
    }])).toEqual([
      { participantId: 'creditor', currency: 'MYR', netMinor: 2_000 },
      { participantId: 'debtor', currency: 'MYR', netMinor: -2_000 },
    ])
  })
})

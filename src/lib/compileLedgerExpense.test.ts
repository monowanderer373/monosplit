import { describe, expect, it } from 'vitest'
import {
  compileLedgerExpense,
  type LedgerExpenseDraft,
} from './compileExpense'

function buildDraft(overrides: Partial<LedgerExpenseDraft> = {}): LedgerExpenseDraft {
  return {
    clientRequestId: '11111111-1111-4111-8111-111111111111',
    scope: 'direct',
    spaceId: null,
    currentParticipantId: 'dav',
    amount: '100.00',
    currency: 'MYR',
    description: '',
    category: 'Other',
    occurredOn: '2026-08-30',
    participants: [
      { id: 'lan', displayName: 'Lan', kind: 'account' },
      { id: 'dav', displayName: 'Dav', kind: 'account' },
      { id: 'mei', displayName: 'Mei', kind: 'manual' },
    ],
    payerAmounts: { dav: '70.00', lan: '30.00' },
    splitMode: 'equal',
    exactShareAmounts: {},
    ...overrides,
  }
}

describe('compileLedgerExpense', () => {
  it('puts the current participant first and keeps integer reconciliation', () => {
    const result = compileLedgerExpense(buildDraft())
    expect(result).toEqual({
      ok: true,
      command: expect.objectContaining({
        participantIds: ['dav', 'lan', 'mei'],
        contributionAmounts: [7000, 3000, 0],
        shareAmounts: [3334, 3333, 3333],
        description: null,
      }),
    })
  })

  it('accepts exact splits only when every minor unit reconciles', () => {
    const valid = compileLedgerExpense(buildDraft({
      splitMode: 'exact',
      exactShareAmounts: { dav: '10.00', lan: '20.00', mei: '70.00' },
    }))
    expect(valid.ok).toBe(true)

    const invalid = compileLedgerExpense(buildDraft({
      splitMode: 'exact',
      exactShareAmounts: { dav: '10.00', lan: '20.00', mei: '69.99' },
    }))
    expect(invalid).toEqual({ ok: false, error: 'invalid_shares' })
  })

  it('defaults a missing payer breakdown to the current participant', () => {
    const result = compileLedgerExpense(buildDraft({ payerAmounts: {} }))
    expect(result).toEqual({
      ok: true,
      command: expect.objectContaining({ contributionAmounts: [10_000, 0, 0] }),
    })
  })

  it('keeps personal expenses private to one participant', () => {
    expect(compileLedgerExpense(buildDraft({
      scope: 'personal',
      participants: [{ id: 'dav', displayName: 'Dav', kind: 'account' }],
      payerAmounts: {},
    })).ok).toBe(true)

    expect(compileLedgerExpense(buildDraft({ scope: 'personal' }))).toEqual({
      ok: false,
      error: 'invalid_participants',
    })
  })
})

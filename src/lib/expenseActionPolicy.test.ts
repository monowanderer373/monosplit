import { describe, expect, it } from 'vitest'
import type { CanonicalExpense } from '../types'
import {
  deriveExpenseActionPolicy,
  financialFailureDisposition,
  isOwnerLocalExpense,
} from './expenseActionPolicy'

function expense(overrides: Partial<CanonicalExpense> = {}): CanonicalExpense {
  const id = overrides.id ?? 'expense-1'
  return {
    id,
    clientRequestId: `request-${id}`,
    scope: 'personal',
    spaceId: null,
    createdBy: 'owner',
    totalMinor: 10_000,
    participantCount: 1,
    currency: 'MYR',
    description: 'Dinner',
    category: 'Food',
    occurredOn: '2026-09-08',
    status: 'active',
    version: 1,
    correctsExpenseId: null,
    terminationKind: null,
    voidedAt: null,
    createdAt: '2026-09-08T10:00:00Z',
    updatedAt: '2026-09-08T10:00:00Z',
    participations: [{
      id: `${id}-owner`,
      expenseId: id,
      participantId: 'owner',
      nameSnapshot: 'Owner',
      order: 0,
      state: 'accepted',
      trackingMode: 'tracked',
    }],
    payerContributions: [],
    shares: [],
    ...overrides,
  }
}

describe('expense action policy', () => {
  it('A: gives Personal expenses safe edit and cancel without correction', () => {
    const result = deriveExpenseActionPolicy({
      expense: expense(),
      currentParticipantId: 'owner',
    })
    expect(result.classification).toBe('personal')
    expect(result.actions).toEqual(['edit_metadata', 'edit_financials', 'cancel'])
  })

  it('B: treats an all-Manual Direct expense as owner-local', () => {
    const direct = expense({
      scope: 'direct',
      participantCount: 2,
      participations: [
        expense().participations[0],
        {
          id: 'manual',
          expenseId: 'expense-1',
          participantId: 'manual-principal',
          nameSnapshot: 'Cash guest',
          order: 1,
          state: 'untracked',
          trackingMode: 'untracked',
        },
      ],
    })
    const result = deriveExpenseActionPolicy({
      expense: direct,
      currentParticipantId: 'owner',
    })
    expect(result.classification).toBe('manual_direct')
    expect(result.actions).toContain('edit_financials')
    expect(result.actions).toContain('cancel')
  })

  it('C: warns that an unconfirmed Linked Direct edit re-pends confirmation', () => {
    const result = deriveExpenseActionPolicy({
      expense: linkedDirect('pending'),
      currentParticipantId: 'owner',
    })
    expect(result.classification).toBe('linked_direct_pending')
    expect(result.actions).toContain('edit_financials')
    expect(result.financialEditRequiresReconfirmation).toBe(true)
  })

  it('D/E: replaces financial edit and immediate cancel for confirmed Direct', () => {
    const result = deriveExpenseActionPolicy({
      expense: linkedDirect('accepted'),
      currentParticipantId: 'owner',
    })
    expect(result.actions).toEqual([
      'edit_metadata',
      'propose_correction',
      'request_cancellation',
    ])
    expect(result.actions).not.toContain('edit_financials')
    expect(result.actions).not.toContain('cancel')
  })

  it('freezes a pending candidate and a target with an open request', () => {
    expect(deriveExpenseActionPolicy({
      expense: expense({ scope: 'direct', status: 'correction_pending' }),
      currentParticipantId: 'owner',
    })).toMatchObject({ classification: 'correction_pending', mutationBlocked: true })

    expect(deriveExpenseActionPolicy({
      expense: linkedDirect('accepted'),
      currentParticipantId: 'owner',
      pendingRequest: { id: 'change' } as never,
    }).actions).toEqual(['view_request'])
  })

  it('makes superseded and cancelled records read-only', () => {
    expect(deriveExpenseActionPolicy({
      expense: expense({ status: 'voided', terminationKind: 'corrected' }),
      currentParticipantId: 'owner',
    }).actions).toEqual([])
    expect(deriveExpenseActionPolicy({
      expense: expense({ status: 'voided', terminationKind: 'cancelled' }),
      currentParticipantId: 'owner',
    }).actions).toEqual([])
  })

  it('uses existing Space creator/owner authority without Direct approval', () => {
    const shared = expense({ scope: 'space', spaceId: 'space-1', createdBy: 'creator' })
    expect(deriveExpenseActionPolicy({
      expense: shared,
      currentParticipantId: 'owner',
      spaceRole: 'owner',
    }).actions).toEqual(['edit_metadata', 'propose_correction', 'cancel'])
    expect(deriveExpenseActionPolicy({
      expense: shared,
      currentParticipantId: 'viewer',
      spaceRole: 'view',
    }).actions).toEqual([])
  })

  it('allows restore eligibility only for creator-owned Personal or all-Manual Direct', () => {
    const manualDirect = expense({
      scope: 'direct',
      participations: [
        expense().participations[0],
        {
          id: 'manual',
          expenseId: 'expense-1',
          participantId: 'manual-principal',
          nameSnapshot: 'Cash guest',
          order: 1,
          state: 'untracked',
          trackingMode: 'untracked',
        },
      ],
    })
    expect(isOwnerLocalExpense(expense(), 'owner')).toBe(true)
    expect(isOwnerLocalExpense(manualDirect, 'owner')).toBe(true)
    expect(isOwnerLocalExpense(linkedDirect('pending'), 'owner')).toBe(false)
    expect(isOwnerLocalExpense(linkedDirect('accepted'), 'owner')).toBe(false)
    expect(isOwnerLocalExpense(expense({ scope: 'space' }), 'owner')).toBe(false)
  })

  it('refetches stale intent and fails closed on invariant violations', () => {
    expect(financialFailureDisposition('version_conflict')).toBe('refetch')
    expect(financialFailureDisposition('change_request_exists')).toBe('refetch')
    expect(financialFailureDisposition('financial_invariant_violation')).toBe('fail_closed')
    expect(financialFailureDisposition('expense_write_denied')).toBe('show_error')
  })
})

function linkedDirect(state: 'pending' | 'accepted'): CanonicalExpense {
  const base = expense({ scope: 'direct', participantCount: 2 })
  return {
    ...base,
    participations: [
      base.participations[0],
      {
        id: 'counterpart',
        expenseId: base.id,
        participantId: 'counterpart',
        nameSnapshot: 'Counterpart',
        order: 1,
        state,
        trackingMode: 'tracked',
      },
    ],
  }
}

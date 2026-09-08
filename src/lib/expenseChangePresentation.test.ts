import { describe, expect, it } from 'vitest'
import type { CanonicalExpense } from '../types'
import type { DirectExpenseChangeRequest } from './expenseChangeRepository'
import {
  deriveDirectChangeHistoryState,
  deriveDirectChangePresentation,
} from './expenseChangePresentation'

const original = expense('original', 10_000, 'active')
const candidate = expense('candidate', 8_000, 'correction_pending')

describe('Direct change presentation', () => {
  it('F/G: keeps A current and excludes pending B from current amount', () => {
    const view = present(request(), 'owner')
    expect(view.currentExpense).toBe(original)
    expect(view.proposedExpense).toBe(candidate)
    expect(view.currentExpense?.totalMinor).toBe(10_000)
    expect(view.candidateAffectsCurrentAmount).toBe(false)
  })

  it('H: exposes complete multi-account approval progress to proposer', () => {
    const view = present(request({
      approvals: [
        approval('one', 'accepted'),
        approval('two', 'pending'),
      ],
    }), 'owner')
    expect(view).toMatchObject({
      approvedCount: 1,
      visibleApprovalCount: 2,
      hasCompleteApprovalProgress: true,
    })
  })

  it('I/J: only a required pending approver receives response actions', () => {
    expect(present(request(), 'one').canRespond).toBe(true)
    expect(present(request(), 'viewer').canRespond).toBe(false)
  })

  it('N: does not expose numeric approval progress to an approver', () => {
    const view = present(request({
      approvals: [approval('one', 'pending')],
    }), 'one')
    expect(view.hasCompleteApprovalProgress).toBe(false)
  })

  it('K: proposer may withdraw only while pending', () => {
    expect(present(request(), 'owner').canWithdraw).toBe(true)
    expect(present(request({ state: 'declined' }), 'owner').canWithdraw).toBe(false)
  })

  it('L: authoritative correction makes B current and A historical', () => {
    const view = present(request({ state: 'authoritative' }), 'owner')
    expect(view.currentExpense).toBe(candidate)
    expect(view.historicalExpense).toBe(original)
    expect(view.proposedExpense).toBeNull()
  })

  it('M/N: decline or withdrawal keeps A current', () => {
    expect(present(request({ state: 'declined' }), 'owner').currentExpense).toBe(original)
    expect(present(request({ state: 'cancelled' }), 'owner').currentExpense).toBe(original)
  })

  it('O/P: pending cancellation keeps A current; final cancellation removes it', () => {
    const cancellation = request({ kind: 'cancellation', replacementExpenseId: null })
    expect(present(cancellation, 'owner').currentExpense).toBe(original)
    expect(present(
      { ...cancellation, state: 'authoritative' },
      'owner',
    ).currentExpense).toBeNull()
  })

  it('uses distinct correction and cancellation lifecycle semantics', () => {
    expect(deriveDirectChangeHistoryState(request())).toBe('correction_proposed')
    expect(deriveDirectChangeHistoryState(request({ state: 'authoritative' })))
      .toBe('correction_approved')
    expect(deriveDirectChangeHistoryState(request({ state: 'declined' })))
      .toBe('correction_declined')
    expect(deriveDirectChangeHistoryState(request({ state: 'cancelled' })))
      .toBe('correction_withdrawn')
    expect(deriveDirectChangeHistoryState(request({
      kind: 'cancellation',
      replacementExpenseId: null,
    }))).toBe('cancellation_requested')
    expect(deriveDirectChangeHistoryState(request({
      kind: 'cancellation',
      replacementExpenseId: null,
      state: 'authoritative',
    }))).toBe('expense_cancelled')
  })
})

function present(change: DirectExpenseChangeRequest, currentParticipantId: string) {
  return deriveDirectChangePresentation({
    request: change,
    targetExpense: original,
    replacementExpense: change.kind === 'correction' ? candidate : null,
    currentParticipantId,
  })
}

function request(
  overrides: Partial<DirectExpenseChangeRequest> = {},
): DirectExpenseChangeRequest {
  return {
    id: 'change',
    clientRequestId: 'client-change',
    kind: 'correction',
    state: 'pending',
    proposedBy: 'owner',
    targetExpenseId: original.id,
    replacementExpenseId: candidate.id,
    targetVersion: 1,
    version: 1,
    reason: null,
    createdAt: '2026-09-08T10:00:00Z',
    updatedAt: '2026-09-08T10:00:00Z',
    approvals: [approval('one', 'pending')],
    ...overrides,
  }
}

function approval(
  participantId: string,
  state: 'pending' | 'accepted' | 'declined',
) {
  return {
    participantId,
    state,
    respondedAt: state === 'pending' ? null : '2026-09-08T11:00:00Z',
    createdAt: '2026-09-08T10:00:00Z',
  }
}

function expense(
  id: string,
  totalMinor: number,
  status: CanonicalExpense['status'],
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
    description: 'Dinner',
    category: 'Food',
    occurredOn: '2026-09-08',
    status,
    version: 1,
    correctsExpenseId: null,
    terminationKind: null,
    voidedAt: null,
    createdAt: '2026-09-08T10:00:00Z',
    updatedAt: '2026-09-08T10:00:00Z',
    participations: [],
    payerContributions: [],
    shares: [],
  }
}

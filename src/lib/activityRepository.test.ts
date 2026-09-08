import { describe, expect, it } from 'vitest'
import {
  coalesceFinancialActivity,
  type FinancialActivity,
} from './activityRepository'

describe('financial activity presentation', () => {
  it('collapses the final approval write into one authoritative correction action', () => {
    const events = [
      event('final-approval', 'expense.correction_approval_accepted', '11:00'),
      event('corrected', 'expense.corrected', '11:00'),
      event('earlier-approval', 'expense.correction_approval_accepted', '10:30'),
      event('proposed', 'expense.correction_proposed', '10:00'),
    ]

    expect(coalesceFinancialActivity(events).map((item) => item.id)).toEqual([
      'corrected',
      'earlier-approval',
      'proposed',
    ])
  })

  it('collapses final cancellation approval but preserves request chronology', () => {
    const events = [
      event('final-approval', 'expense.cancellation_approval_accepted', '11:00'),
      event('cancelled', 'expense.cancelled', '11:00'),
      event('requested', 'expense.cancellation_requested', '10:00'),
    ]
    expect(coalesceFinancialActivity(events).map((item) => item.eventType)).toEqual([
      'expense.cancelled',
      'expense.cancellation_requested',
    ])
  })
})

function event(
  id: string,
  eventType: string,
  time: string,
): FinancialActivity {
  return {
    id,
    actorParticipantId: 'actor',
    expenseId: 'expense',
    settlementPaymentId: null,
    spaceId: null,
    eventType,
    safeDiff: {},
    createdAt: `2026-09-08T${time}:00Z`,
  }
}

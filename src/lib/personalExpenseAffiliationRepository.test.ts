import { describe, expect, it } from 'vitest'
import { mapPersonalExpenseAffiliationRow } from './personalExpenseAffiliationRepository'

describe('personal expense affiliation repository', () => {
  it('maps the private database row into the UI data contract', () => {
    expect(mapPersonalExpenseAffiliationRow({
      id: 'affiliation-1',
      owner_participant_id: 'owner-1',
      expense_id: 'expense-1',
      label: 'Hanoi Days',
      archived_at: null,
      version: 2,
      created_at: '2026-09-21T10:00:00.000Z',
      updated_at: '2026-09-21T11:00:00.000Z',
    })).toEqual({
      id: 'affiliation-1',
      ownerParticipantId: 'owner-1',
      expenseId: 'expense-1',
      label: 'Hanoi Days',
      archivedAt: null,
      version: 2,
      createdAt: '2026-09-21T10:00:00.000Z',
      updatedAt: '2026-09-21T11:00:00.000Z',
    })
  })

  it('preserves archived state for management views', () => {
    expect(mapPersonalExpenseAffiliationRow({
      id: 'affiliation-2',
      owner_participant_id: 'owner-1',
      expense_id: 'expense-2',
      label: 'Old journey',
      archived_at: '2026-09-21T12:00:00.000Z',
      version: 3,
      created_at: '2026-09-20T10:00:00.000Z',
      updated_at: '2026-09-21T12:00:00.000Z',
    }).archivedAt).toBe('2026-09-21T12:00:00.000Z')
  })
})

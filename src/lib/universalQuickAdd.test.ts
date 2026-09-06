import { describe, expect, it } from 'vitest'
import type { LedgerDraftParticipant } from './compileExpense'
import {
  applySuggestedCategory,
  createUniversalQuickAddSession,
  hasCustomContextConfiguration,
  saveFeedbackLabel,
  sessionForIdentity,
  remapQuickAddParticipant,
  switchUniversalQuickAddContext,
  updateUniversalQuickAddValues,
  type ResolvedMoneyContext,
} from './universalQuickAdd'

const self: LedgerDraftParticipant = {
  id: 'self',
  displayName: 'Me',
  kind: 'account',
}
const lan: LedgerDraftParticipant = {
  id: 'lan',
  displayName: 'Lan',
  kind: 'manual',
}

function resolved(
  ref: ResolvedMoneyContext['ref'],
  participants: LedgerDraftParticipant[] = [self],
): ResolvedMoneyContext {
  return {
    ref,
    currentParticipantId: 'self',
    availableParticipants: participants,
    defaultCurrency: 'MYR',
  }
}

function session() {
  return createUniversalQuickAddSession({
    identityKey: 'user-a',
    sessionId: 'session-1',
    clientRequestId: 'request-1',
    startedAtMs: 1,
    entryPoint: 'global',
    context: resolved({ kind: 'personal' }),
  })
}

describe('Universal Quick Add session', () => {
  it('does not return an unsaved session to a different identity', () => {
    const dirty = updateUniversalQuickAddValues(session(), {
      amount: '120',
      description: 'Dinner',
      payerAmounts: { self: '120' },
    })

    expect(sessionForIdentity(dirty, 'user-a')).toBe(dirty)
    expect(sessionForIdentity(dirty, 'user-b')).toBeNull()
  })

  it('preserves common fields and resets context-dependent configuration', () => {
    const dirty = updateUniversalQuickAddValues(session(), {
      amount: '120',
      description: 'Dinner',
      occurredOn: '2026-09-06',
      category: 'Food',
      categorySource: 'SUGGESTED',
      splitMode: 'exact',
      exactShareAmounts: { self: '60' },
      payerAmounts: { self: '120' },
    })

    const switched = switchUniversalQuickAddContext(
      dirty,
      resolved(
        {
          kind: 'person',
          personId: 'person-lan',
          participantId: 'lan',
          participantIds: ['lan'],
          participantKind: 'manual',
          displayName: 'Lan',
        },
        [self, lan],
      ),
    )

    expect(switched.values).toMatchObject({
      amount: '120',
      description: 'Dinner',
      occurredOn: '2026-09-06',
      category: '',
      categorySource: 'DEFAULT',
      splitMode: 'equal',
      exactShareAmounts: {},
      payerAmounts: {},
      selectedParticipantIds: ['self', 'lan'],
    })
  })

  it('preserves a user category when the context changes', () => {
    const dirty = updateUniversalQuickAddValues(session(), {
      category: 'Shopping',
      categorySource: 'USER',
    })

    const switched = switchUniversalQuickAddContext(
      dirty,
      resolved(
        {
          kind: 'person',
          personId: 'person-lan',
          participantId: 'lan',
          participantIds: ['lan'],
          participantKind: 'manual',
          displayName: 'Lan',
        },
        [self, lan],
      ),
    )

    expect(switched.values.category).toBe('Shopping')
    expect(switched.values.categorySource).toBe('USER')
  })

  it.each(['DEFAULT', 'SUGGESTED'] as const)(
    'resets a %s category for the next context',
    (categorySource) => {
      const dirty = updateUniversalQuickAddValues(session(), {
        category: 'Food',
        categorySource,
      })

      const switched = switchUniversalQuickAddContext(
        dirty,
        resolved(
          {
            kind: 'person',
            personId: 'person-lan',
            participantId: 'lan',
            participantIds: ['lan'],
            participantKind: 'manual',
            displayName: 'Lan',
          },
          [self, lan],
        ),
      )

      expect(switched.values.category).toBe('')
      expect(switched.values.categorySource).toBe('DEFAULT')
    },
  )

  it('marks deterministic category suggestions without overriding a user choice', () => {
    const suggested = applySuggestedCategory(session().values, 'Food')
    expect(suggested).toMatchObject({
      category: 'Food',
      categorySource: 'SUGGESTED',
    })

    const userChoice = {
      ...suggested,
      category: 'Shopping',
      categorySource: 'USER' as const,
    }
    expect(applySuggestedCategory(userChoice, 'Transport')).toBe(userChoice)
  })

  it('remaps an unsaved Person draft at the save boundary only', () => {
    const values = updateUniversalQuickAddValues(session(), {
      selectedParticipantIds: ['self', 'manual-lan'],
      payerAmounts: { 'manual-lan': '20' },
      exactShareAmounts: { self: '10', 'manual-lan': '10' },
    }).values

    expect(
      remapQuickAddParticipant(values, 'manual-lan', 'account-lan'),
    ).toMatchObject({
      selectedParticipantIds: ['self', 'account-lan'],
      payerAmounts: { 'account-lan': '20' },
      exactShareAmounts: { self: '10', 'account-lan': '10' },
    })
  })

  it('detects custom configuration before a destructive context switch', () => {
    expect(hasCustomContextConfiguration(session())).toBe(false)
    expect(
      hasCustomContextConfiguration(
        updateUniversalQuickAddValues(session(), {
          payerAmounts: { self: '20' },
        }),
      ),
    ).toBe(true)
  })

  it('does not switch a locked recurring session', () => {
    const locked = createUniversalQuickAddSession({
      identityKey: 'user-a',
      sessionId: 'session-1',
      clientRequestId: 'request-1',
      startedAtMs: 1,
      entryPoint: 'recurring-draft',
      contextPolicy: 'locked',
      context: resolved({ kind: 'personal' }),
    })

    expect(
      switchUniversalQuickAddContext(
        locked,
        resolved(
          {
            kind: 'person',
            personId: 'person-lan',
            participantId: 'lan',
            participantIds: ['lan'],
            participantKind: 'manual',
            displayName: 'Lan',
          },
          [self, lan],
        ),
      ),
    ).toBe(locked)
  })

  it('maps real save outcomes to distinct completion feedback', () => {
    const translate = (key: string) => key
    expect(
      saveFeedbackLabel(
        { kind: 'recorded' },
        translate as Parameters<typeof saveFeedbackLabel>[1],
      ),
    ).toBe('quickAdd.feedback.recorded')
    expect(
      saveFeedbackLabel(
        { kind: 'awaiting-confirmation' },
        translate as Parameters<typeof saveFeedbackLabel>[1],
      ),
    ).toBe('quickAdd.feedback.awaitingConfirmation')
    expect(
      saveFeedbackLabel(
        { kind: 'pending-sync' },
        translate as Parameters<typeof saveFeedbackLabel>[1],
      ),
    ).toBe('quickAdd.feedback.pendingSync')
    expect(
      saveFeedbackLabel(
        { kind: 'needs-attention' },
        translate as Parameters<typeof saveFeedbackLabel>[1],
      ),
    ).toBe('quickAdd.feedback.needsAttention')
  })
})

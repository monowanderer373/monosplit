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

// Issue07 adds protected Trip association metadata; ordinary Group/Direct paths
// above retain their original scope and financial compilation.
it('compiles new self-only Trip capture to personal while preserving the stable Trip association',()=>{
 const result=compileLedgerExpense(buildDraft({scope:'space',spaceId:'trip',participants:[{id:'dav',displayName:'Dav',kind:'account'}],consumerParticipantIds:['dav'],payerAmounts:{dav:'100'},tripEditor:{tripId:'trip',consumerIds:['dav'],mode:'equal',items:[]}}));expect(result).toMatchObject({ok:true,command:{scope:'personal',spaceId:null,participantIds:['dav'],shareAmounts:[10000],tripEditor:{tripId:'trip',consumerIds:['dav']}}})
})
it('keeps explicit zero-share Trip consumers Shared and rejects a mismatched association',()=>{
 const draft=buildDraft({scope:'space',spaceId:'trip',participants:[{id:'dav',displayName:'Dav',kind:'account'},{id:'lan',displayName:'Lan',kind:'account'}],consumerParticipantIds:['dav','lan'],payerAmounts:{dav:'100'},splitMode:'exact',exactShareAmounts:{dav:'100',lan:'0'},tripEditor:{tripId:'trip',consumerIds:['lan','dav'],mode:'exact',items:[]}});expect(compileLedgerExpense(draft)).toMatchObject({ok:true,command:{scope:'space',spaceId:'trip',shareAmounts:[10000,0],tripEditor:{consumerIds:['dav','lan']}}});expect(compileLedgerExpense({...draft,tripEditor:{...draft.tripEditor!,tripId:'another'}})).toMatchObject({ok:false,error:'invalid_scope'})
})
it('does not publish stale item metadata against different canonical shares',()=>{
 const draft=buildDraft({scope:'space',spaceId:'trip',participants:[{id:'dav',displayName:'Dav',kind:'account'},{id:'lan',displayName:'Lan',kind:'account'}],consumerParticipantIds:['dav','lan'],payerAmounts:{dav:'100'},splitMode:'exact',exactShareAmounts:{dav:'100',lan:'0'},tripEditor:{tripId:'trip',consumerIds:['dav','lan'],mode:'items',items:[{id:'meal',name:'Meal',amount:'100',participantIds:['lan']}]}});expect(compileLedgerExpense(draft)).toMatchObject({ok:false,error:'invalid_shares'})
})

/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest'
import { createUniversalQuickAddSession, todayIso } from './universalQuickAdd'
import { readQuickDraft, writeQuickDraft } from './quickDraft'
const trip = { kind: 'space' as const, spaceId: 'a', spaceType: 'trip' as const, displayName: 'A' }
const draft = createUniversalQuickAddSession({ identityKey: 'u', sessionId: 's', clientRequestId: 'request', startedAtMs: 1, entryPoint: 'global', context: { ref: trip, currentParticipantId: 'self', availableParticipants: [{id:'self',displayName:'Me',kind:'account'}], defaultCurrency: 'MYR' }, initialValues: {amount:'42'} })
afterEach(() => localStorage.clear())
it('migrates a legacy draft only into its original ledger', () => {
 localStorage.setItem('tt-quick-draft:u',JSON.stringify({day:todayIso(),session:draft}))
 expect(readQuickDraft('u')).toBeNull()
 expect(readQuickDraft('u',trip)?.clientRequestId).toBe('request')
 writeQuickDraft('u',{...draft,context:{...draft.context!,ref:{kind:'personal'}},values:{...draft.values,amount:'9'}})
 expect(readQuickDraft('u',trip)?.values.amount).toBe('42')
 expect(readQuickDraft('u')?.values.amount).toBe('9')
})
it('rejects expired drafts and a draft stored under another identity', () => {
 localStorage.setItem('tt-quick-draft:u',JSON.stringify({day:'2000-01-01',session:draft}))
 expect(readQuickDraft('u',trip)).toBeNull()
 localStorage.setItem('tt-quick-draft:other',JSON.stringify({day:todayIso(),session:draft}))
 expect(readQuickDraft('other',trip)).toBeNull()
})
it('recovers from corrupt storage and clears only the saved ledger', () => {
 localStorage.setItem('tt-quick-draft:u','broken json')
 writeQuickDraft('u',draft)
 expect(readQuickDraft('u',trip)?.values.amount).toBe('42')
 writeQuickDraft('u',{...draft,context:{...draft.context!,ref:{kind:'personal'}}})
 writeQuickDraft('u',null,trip)
 expect(readQuickDraft('u',trip)).toBeNull()
 expect(readQuickDraft('u')?.values.amount).toBe('42')
})

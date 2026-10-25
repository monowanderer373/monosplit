import {beforeEach,expect,it,vi} from 'vitest'
import {spendingExpense} from '../test/spendingFixtures'
const mock=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./supabase',()=>({supabase:{rpc:mock.rpc}}))
import {NO_PERIOD_CAPABILITY,activePersonalExpenses,activePeriodJournals,loadPersonalPeriods,parseFreshPreview,parseFreshReceipt,parsePeriodState,reconcileFreshStart} from './personalPeriods'
const raw={schema_version:1,owner_id:'you',periods:[{id:'old',status:'archived',started_at:'2026-01-01T00:00:00Z',ended_at:'2026-10-25T00:00:00Z'}],archived_expense_ids:['old','shared'],archived_transaction_ids:['cash-old'],later_funding:[]}
beforeEach(()=>mock.rpc.mockReset())
it('only filters personal reporting; protected Shared facts remain available even with a stale archive membership',()=>{
 const facts=[spendingExpense('old'),spendingExpense('new'),spendingExpense('shared',1800,'direct')]
 expect(activePersonalExpenses(facts,parsePeriodState(raw,'you')).map(e=>e.id)).toEqual(['new','shared'])
 expect(facts).toHaveLength(3)
 expect(activePersonalExpenses(facts,NO_PERIOD_CAPABILITY)).toEqual(facts)
})
it('adds a later native cash activity without counting old spending or duplicating a journal',()=>{
 const state=parsePeriodState({...raw,later_funding:[{id:'late',account_id:'bank',account_name:'Bank',expense_id:'old',occurred_on:'2026-10-25',created_at:'2026-10-25T12:00:00Z',currency:'MYR',amount_minor:'-1620',memo:null}]},'you')
 expect(state.laterFunding[0].kind).toBe('expense_funding')
 expect(activePeriodJournals([state.laterFunding[0]],state)).toHaveLength(1)
 expect(state.laterFunding[0].amountMinor).toBe(-1620)
})
it('rejects cross-principal, corrupt and overflow responses',()=>{
 expect(()=>parsePeriodState(raw,'other')).toThrow('invalid_period_response')
 expect(()=>parsePeriodState({...raw,periods:[{...raw.periods[0],started_at:'broken'}]},'you')).toThrow()
 expect(()=>parsePeriodState({...raw,later_funding:[{amount_minor:'9007199254740992'}]},'you')).toThrow()
 expect(()=>parseFreshReceipt({schema_version:1,owner_id:'other'},'you','r')).toThrow()
})
it('missing capability, network and auth errors never restore old history as verified active reporting',async()=>{
 for(const code of ['PGRST202','42501','PGRST301','network']){mock.rpc.mockResolvedValueOnce({error:{code}});await expect(loadPersonalPeriods('you')).rejects.toEqual({code})}
})
it('requires complete authoritative carry-forward and native-account validation',()=>{
 const p={schema_version:1,owner_id:'you',id:'p',fingerprint:'hash',expires_at:'2026-10-25T12:00:00Z',policy:'carry_all',personal_count:1,protected_shared_count:1,protected_settlement_count:0,pending_funding_count:1,ongoing_installment_count:0,recurring_rule_count:0,conflicts:[],accounts:[{account_id:'a',parent_id:'a',name:'Cash',currency:'MYR',account_class:'asset',account_type:'cash',known:true,balance_minor:'-300',version:1,parent_version:1}],currencies:[{currency:'MYR',amount_minor:'1200'}]}
 expect(parseFreshPreview(p,'you').accounts[0].balance_minor).toBe('-300')
 for(const patch of [{policy:'erase_pending'},{accounts:[...p.accounts,...p.accounts]},{accounts:[{...p.accounts[0],balance_minor:'9007199254740992'}]},{personal_count:-1}])expect(()=>parseFreshPreview({...p,...patch},'you')).toThrow()
})
it('reconciliation does not turn unknown outcomes into a new request',async()=>{
 mock.rpc.mockResolvedValueOnce({data:{state:'fenced'}})
 expect(await reconcileFreshStart('r','you')).toBeNull()
 expect(mock.rpc).toHaveBeenCalledWith('reconcile_personal_fresh_start',{p_request_id:'r'})
 mock.rpc.mockResolvedValueOnce({data:{state:'unknown'}})
 await expect(reconcileFreshStart('r','you')).rejects.toThrow()
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compileLedgerExpense, type LedgerExpenseDraft } from './compileExpense'
const rpc=vi.hoisted(()=>vi.fn())
vi.mock('./supabase',()=>({supabase:{rpc}}))
import { ledgerRepository } from './ledgerRepository'
const draft:LedgerExpenseDraft={clientRequestId:'request',scope:'direct',spaceId:null,currentParticipantId:'self',amount:'90.00',currency:'MYR',description:'Food',category:'Coffee',occurredOn:'2026-10-02',participants:[{id:'self',displayName:'Me',kind:'account'},{id:'friend',displayName:'Friend',kind:'manual'}],payerAmounts:{self:'70',friend:'20'},splitMode:'equal',exactShareAmounts:{},fundingAccountId:'my-wallet'}
beforeEach(()=>rpc.mockReset())
describe('Quick Add owner funding',()=>{
 it('uses the atomic funding command while retaining the actual payer contribution and custom category',async()=>{
  const compiled=compileLedgerExpense(draft);if(!compiled.ok)throw new Error('compile failed')
  expect(compiled.command.contributionAmounts).toEqual([7000,2000])
  expect(compiled.command.category).toBe('Coffee')
  rpc.mockResolvedValue({data:{expense_id:'expense'},error:null})
  expect(await ledgerRepository.createExpense(compiled.command)).toBe('expense')
  expect(rpc).toHaveBeenCalledWith('create_expense_with_funding',expect.objectContaining({funding_request_id:'request',funding_account_id:'my-wallet',funding_account_amount_minor:null,contribution_amounts:[7000,2000]}))
 })
 it('does not debit my wallet when the friend paid everything',async()=>{
  const compiled=compileLedgerExpense({...draft,payerAmounts:{friend:'90'}});if(!compiled.ok)throw new Error('compile failed')
  expect(compiled.command.fundingAccountId).toBeUndefined()
  rpc.mockResolvedValue({data:'expense',error:null})
  await ledgerRepository.createExpense(compiled.command)
  expect(rpc.mock.calls[0][0]).toBe('create_expense')
 })
 it('does not silently retry using the old expense endpoint if funding is rejected',async()=>{
  const compiled=compileLedgerExpense(draft);if(!compiled.ok)throw new Error('compile failed')
  rpc.mockResolvedValue({data:null,error:{message:'personal_account_archived',code:'P0001'}})
  await expect(ledgerRepository.createExpense(compiled.command)).rejects.toThrow('personal_account_archived')
  expect(rpc).toHaveBeenCalledTimes(1)
 })
})

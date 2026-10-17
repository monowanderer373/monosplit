import { enterQuickAmount } from './fixtures/quickAdd'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { createConfirmedAccount, signIn } from './fixtures/localSupabase'
// The existing fixture helper rejects remote services. Financial writes below use normal login only.
const anon='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
async function rpc(client:SupabaseClient,name:string,args:Record<string,unknown>={}){const {data,error}=await client.rpc(name,args);if(error)throw error;return data}
async function seed(){
 const account=await createConfirmedAccount('multicurrency','Native money tester',randomUUID()),client=createClient('http://127.0.0.1:54321',anon,{auth:{persistSession:false,autoRefreshToken:false}})
 const login=await client.auth.signInWithPassword({email:account.email,password:account.password});if(login.error)throw login.error
 const owner=await rpc(client,'current_participant_id')
 const wise=(await rpc(client,'create_personal_account',{request_id:randomUUID(),account_name:'Wise native QA',account_type:'ewallet',currency_code:'MYR',opening_balance_minor:200000,balance_as_of:'2026-10-16',make_default:true})).account_id
 const cash=(await rpc(client,'create_personal_account',{request_id:randomUUID(),account_name:'Cash native QA',account_type:'cash',currency_code:'MYR',opening_balance_minor:null,balance_as_of:null,make_default:false})).account_id
 const all=()=>rpc(client,'get_personal_multicurrency_accounts')
 const parent=(await all()).accounts.find((a:{id:string})=>a.id===cash)
 const vnd=(await rpc(client,'add_personal_account_currency',{request_id:randomUUID(),parent_account_id:cash,currency_code:'VND',expected_version:parent.version,opening_balance_minor:1000000,balance_as_of:'2026-10-16'})).account_id
 return {account,client,owner,wise,cash,vnd,all}
}
test('real isolated DB: Quick Add defers unknown debit, grouped review confirms actual single and multi-source payments once',async({page})=>{
 test.setTimeout(180_000);const s=await seed()
 try{
  const before=await s.all();await signIn(page,s.account);await page.getByRole('button',{name:'Quick add expense',exact:true}).click()
  const quick=page.getByRole('dialog',{name:'Quick Add',exact:true});await quick.getByRole('button',{name:'Food',exact:true}).click();await quick.getByLabel('Currency',{exact:true}).selectOption('VND');await enterQuickAmount(quick,'90000');await quick.getByRole('textbox',{name:'Description',exact:true}).fill('Foreign payment one')
  await expect(quick).toContainText('No balance is deducted yet');await quick.getByRole('button',{name:'Save and close',exact:true}).click();await expect(quick).toHaveCount(0)
  const saved=await s.client.from('expenses').select('id,total_minor,currency').eq('description','Foreign payment one').single();expect(saved.error).toBeNull();expect(saved.data).toMatchObject({total_minor:90000,currency:'VND'})
  expect((await s.all()).accounts.map((a:{id:string;entry_sum_minor:string})=>[a.id,a.entry_sum_minor])).toEqual(before.accounts.map((a:{id:string;entry_sum_minor:string})=>[a.id,a.entry_sum_minor]))
  const second=await rpc(s.client,'create_expense_with_multicurrency_funding',{request_id:randomUUID(),expense_payload:{expense_scope:'personal',target_space_id:null,total_minor:90000,currency_code:'VND',description:'Foreign payment two',category:'Food',occurred_on:'2026-10-16',participant_ids:[s.owner],contribution_amounts:[90000],share_amounts:[90000]},funding_plan:{mode:'deferred',primary_account_id:s.wise,legs:[],covers_owner_payment:false}})
  await page.reload();await expect(page.getByTestId('home-account-notice')).toHaveAccessibleName(/2 to do/);await page.getByTestId('home-account-notice').click();await page.locator(`[data-notice-id="fundinggroup:${s.wise}"]`).click();await expect(page.getByRole('heading',{name:'Verify deductions',exact:true})).toBeVisible();await page.getByRole('button',{name:/Foreign payment one/}).click()
  const review=page.getByTestId('verify-deduction');await review.getByRole('combobox',{name:'Payment source',exact:true}).selectOption(s.wise);await expect(review.getByRole('textbox')).toHaveValue('');await review.getByRole('textbox').fill('16.20');await review.getByRole('checkbox').check();await review.getByRole('button',{name:'Confirm & next'}).dblclick();await expect(review).toContainText('Foreign payment two');await expect(review.getByRole('combobox',{name:'Payment source',exact:true})).toHaveValue('');await expect(review.getByRole('textbox')).toHaveCount(0)
  await review.getByRole('combobox',{name:'Payment source',exact:true}).selectOption(s.vnd);await review.getByRole('textbox').fill('30000');await review.getByRole('combobox',{name:'Was this deduction already included in that balance?',exact:true}).selectOption('excluded');await review.getByRole('button',{name:/Add another payment source/}).click();await review.getByRole('combobox',{name:'Payment source',exact:true}).nth(1).selectOption(s.wise);await review.getByRole('textbox').nth(1).fill('10.80');await review.getByRole('checkbox').check();await review.getByRole('button',{name:'Confirm & finish'}).dblclick();await expect(review).toHaveCount(0);await expect(page.getByRole('main')).toContainText('All current items verified')
  const units=(await s.all()).accounts;expect(units.find((a:{id:string})=>a.id===s.wise).entry_sum_minor).toBe('197300');expect(units.find((a:{id:string})=>a.id===s.vnd).entry_sum_minor).toBe('970000')
  const legs=await s.client.from('personal_funding_bundle_legs').select('id,amount_minor,currency');expect(legs.error).toBeNull();expect(legs.data).toHaveLength(3)
  const expenses=await s.client.from('expenses').select('id,total_minor,currency').in('id',[saved.data!.id,second.expense_id]);expect(expenses.error).toBeNull();expect(expenses.data?.every(e=>e.total_minor===90000&&e.currency==='VND')).toBe(true)
  const oldClient=await s.client.from('personal_accounts').select('id');expect(oldClient.error).toBeNull();expect(oldClient.data).toHaveLength(2)
 }finally{await s.client.auth.signOut()}
})
test('real isolated DB: withdrawal includes source fee once; later fee itemisation adds an expense without a second debit',async({page})=>{
 test.setTimeout(180_000);const s=await seed()
 try{
  await signIn(page,s.account);await page.goto(`/accounts/move/transfer?from=${s.wise}`);await page.getByRole('combobox',{name:'To',exact:true}).selectOption(s.vnd);await page.getByLabel(/Total deducted/).fill('150');await page.getByLabel(/Cash received/).fill('900000');await page.getByRole('combobox',{name:/Cash native QA.*already included/}).selectOption({label:'Not included'});await page.getByRole('button',{name:'Fee details (optional)',exact:true}).click();await page.getByLabel(/Fee amount/).fill('2');await page.getByRole('button',{name:'Record withdrawal',exact:true}).dblclick();await expect(page).toHaveURL(/accounts\/movements\//)
  let units=(await s.all()).accounts;expect(units.find((a:{id:string})=>a.id===s.wise).entry_sum_minor).toBe('185000');expect(units.find((a:{id:string})=>a.id===s.vnd).entry_sum_minor).toBe('1900000')
  const first=await s.client.from('expenses').select('id,total_minor,currency');expect(first.error).toBeNull();expect(first.data).toHaveLength(1);expect(first.data![0]).toMatchObject({total_minor:200,currency:'MYR'})
  await page.goto(`/accounts/move/transfer?from=${s.wise}`);await page.getByRole('combobox',{name:'To',exact:true}).selectOption(s.vnd);await page.getByLabel(/Total deducted/).fill('10');await page.getByLabel(/Cash received/).fill('60000');await page.getByRole('combobox',{name:/Cash native QA.*already included/}).selectOption({label:'Not included'});await page.getByRole('button',{name:'Record withdrawal',exact:true}).click();await expect(page).toHaveURL(/accounts\/movements\//)
  const before=(await s.all()).accounts.map((a:{id:string;entry_sum_minor:string})=>[a.id,a.entry_sum_minor]);await page.getByLabel(/Fee amount/).fill('0.20');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByLabel(/Fee amount/)).toHaveCount(0)
  units=(await s.all()).accounts;expect(units.map((a:{id:string;entry_sum_minor:string})=>[a.id,a.entry_sum_minor])).toEqual(before)
  const expenses=await s.client.from('expenses').select('total_minor,currency').order('total_minor');expect(expenses.error).toBeNull();expect(expenses.data).toEqual([{total_minor:20,currency:'MYR'},{total_minor:200,currency:'MYR'}])
  const feeJournal=await s.client.from('personal_account_transactions').select('id').eq('kind','expense_funding');expect(feeJournal.error).toBeNull();expect(feeJournal.data).toHaveLength(1)
 }finally{await s.client.auth.signOut()}
})
test('real isolated DB: observed balance and late deduction coverage preserve 100 or debit to 83.80 explicitly',async({page})=>{
 test.setTimeout(180_000);const s=await seed()
 try{
  const old=await rpc(s.client,'create_expense_with_funding',{request_id:randomUUID(),expense_scope:'personal',target_space_id:null,total_minor:2000,currency_code:'MYR',description:'Recorded before balance was known',category:'Food',occurred_on:'2026-10-16',participant_ids:[s.owner],contribution_amounts:[2000],share_amounts:[2000],funding_request_id:randomUUID(),funding_account_id:s.cash,funding_account_amount_minor:2000})
  await signIn(page,s.account);await page.goto(`/accounts/${s.cash}/currencies`);await page.getByRole('button',{name:/MYR.*Set balance/}).click();const balance=page.getByTestId('account-currency-dialog');await balance.getByLabel(/Observed balance/).fill('100');await balance.getByRole('combobox',{name:'Which recorded entries are already included in this observed balance?',exact:true}).selectOption('all');await balance.getByRole('button',{name:'Set balance',exact:true}).click();await expect(balance).toHaveCount(0)
  expect((await s.all()).accounts.find((a:{id:string})=>a.id===s.cash).entry_sum_minor).toBe('10000')
  for(const [description,coverage,expected] of [['Already reflected deduction','included','10000'],['New deduction outside balance','excluded','8380']] as const){
   const created=await rpc(s.client,'create_expense_with_multicurrency_funding',{request_id:randomUUID(),expense_payload:{expense_scope:'personal',target_space_id:null,total_minor:1620,currency_code:'MYR',description,category:'Food',occurred_on:'2026-10-16',participant_ids:[s.owner],contribution_amounts:[1620],share_amounts:[1620]},funding_plan:{mode:'deferred',primary_account_id:s.cash,legs:[],covers_owner_payment:false}})
   await page.goto('/?'+new URLSearchParams({notice:'funding',target:created.funding.funding_intent_id}));const target=page.getByTestId('notification-target');await target.getByRole('combobox',{name:'Payment source',exact:true}).selectOption(s.cash);await target.getByRole('textbox').fill('16.20');await target.getByRole('combobox',{name:'Was this deduction already included in that balance?',exact:true}).selectOption(coverage);await target.getByRole('checkbox').check();await target.getByRole('button',{name:'Confirm & finish'}).dblclick();await expect(target).toContainText('already been handled');expect((await s.all()).accounts.find((a:{id:string})=>a.id===s.cash).entry_sum_minor).toBe(expected)
  }
  const unchanged=await s.client.from('expenses').select('total_minor,currency,version,status').eq('id',old.expense_id).single();expect(unchanged.error).toBeNull();expect(unchanged.data).toEqual({total_minor:2000,currency:'MYR',version:1,status:'active'})
  const journals=await s.client.from('personal_account_transactions').select('id').eq('expense_id',old.expense_id).eq('kind','expense_funding');expect(journals.error).toBeNull();expect(journals.data).toHaveLength(1)
 }finally{await s.client.auth.signOut()}
})

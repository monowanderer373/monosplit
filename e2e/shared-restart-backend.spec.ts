import {randomUUID} from 'node:crypto'
import {createClient,type SupabaseClient} from '@supabase/supabase-js'
import {test,expect} from '@playwright/test'
import {createConfirmedAccount,signIn,MOBILE_CONTEXT_OPTIONS} from './fixtures/localSupabase'
// Disposable localhost stack only. This public demo key is never a production credential.
const anon='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
async function rpc(client:SupabaseClient,name:string,args:Record<string,unknown>={}){const{data,error}=await client.rpc(name,args);if(error)throw error;return data}
async function session(label:string){const account=await createConfirmedAccount(label,'Reset '+label,randomUUID());const client=createClient('http://127.0.0.1:54321',anon,{auth:{persistSession:false,autoRefreshToken:false}});const{error}=await client.auth.signInWithPassword({email:account.email,password:account.password});if(error)throw error;return{account,client,owner:await rpc(client,'current_participant_id')as string}}
async function facts(client:SupabaseClient){const result:Record<string,unknown>={};for(const table of['expenses','expense_participations','payer_contributions','expense_shares','settlement_payments','settlement_allocations']){const{data,error}=await client.from(table).select('*');if(error)throw error;result[table]=data.map(r=>JSON.stringify(r)).sort()}return result}
async function cashFacts(client:SupabaseClient){const{data,error}=await client.from('personal_account_entries').select('*');if(error)throw error;return data.map(r=>JSON.stringify(r)).sort()}
async function balance(client:SupabaseClient,accountId:string){const r=await rpc(client,'get_personal_multicurrency_accounts');return Number(r.accounts.find((a:{id:string})=>a.id===accountId).entry_sum_minor)}
test('real shared Reset, original-bill remove/retag UI, and original native settlement post once',async({page,browser})=>{
 test.setTimeout(180_000)
 const a=await session('restart-a'),b=await session('restart-b'),date=new Date().toISOString().slice(0,10),otherContext=await browser.newContext(MOBILE_CONTEXT_OPTIONS),otherPage=await otherContext.newPage()
 try{
  const aw=(await rpc(a.client,'create_personal_account',{request_id:randomUUID(),account_name:'Reset MYR',account_type:'bank',currency_code:'MYR',opening_balance_minor:10000,balance_as_of:date,make_default:false})).account_id
  const bw=(await rpc(b.client,'create_personal_account',{request_id:randomUUID(),account_name:'Other MYR',account_type:'bank',currency_code:'MYR',opening_balance_minor:25000,balance_as_of:date,make_default:false})).account_id
  const invite=await rpc(a.client,'create_friend_invite');await rpc(b.client,'accept_friend_invite',{raw_token:invite})
  async function bill(currency:string,total:number,title:string){const id=await rpc(b.client,'create_expense',{request_id:randomUUID(),expense_scope:'direct',target_space_id:null,total_minor:total,currency_code:currency,description:title,category:'Food',occurred_on:date,participant_ids:[b.owner,a.owner],contribution_amounts:[total,0],share_amounts:[total/2,total/2]});await rpc(a.client,'respond_to_direct_expense',{target_expense_id:id,response:'accepted',expected_expense_version:1});return id as string}
  const original=await bill('MYR',2000,'Retained original dinner'),removable=await bill('JPY',1000,'Other cleared bill')
  async function pay(amount:number,expected:number){
   const payment=await rpc(a.client,'propose_settlement',{request_id:randomUUID(),settlement_scope:'direct',target_space_id:null,currency_code:'MYR',total_amount_minor:amount,payment_date:date,creditor_ids:[b.owner],allocation_amounts:[amount],settlement_note:'Actual isolated payment',overpay_disposition:null,expected_outstanding_minor:expected,selected_expense_ids:[original],attribution_amounts:[amount],source_payment_request_id:null})
   const{data,error}=await b.client.from('settlement_allocations').select('id').eq('settlement_payment_id',payment).single();if(error)throw error
   await rpc(a.client,'authorize_personal_settlement_cash_leg',{request_id:randomUUID(),target_allocation_id:data.id,cash_role:'payer',target_account_id:aw,supplied_cash_amount_minor:amount})
   await rpc(b.client,'authorize_personal_settlement_cash_leg',{request_id:randomUUID(),target_allocation_id:data.id,cash_role:'receiver',target_account_id:bw,supplied_cash_amount_minor:amount})
   await rpc(b.client,'respond_to_settlement',{target_allocation_id:data.id,response:'accepted',expected_payment_version:1})
  }
  await pay(300,1000)
  const obsoletePayment=await rpc(a.client,'propose_settlement',{request_id:randomUUID(),settlement_scope:'direct',target_space_id:null,currency_code:'MYR',total_amount_minor:100,payment_date:date,creditor_ids:[b.owner],allocation_amounts:[100],settlement_note:'Not confirmed before Reset',overpay_disposition:null,expected_outstanding_minor:700,selected_expense_ids:[original],attribution_amounts:[100],source_payment_request_id:null})
  const{data:obsolete,error:obsoleteError}=await a.client.from('settlement_allocations').select('id').eq('settlement_payment_id',obsoletePayment).single();if(obsoleteError)throw obsoleteError
  await rpc(a.client,'authorize_personal_settlement_cash_leg',{request_id:randomUUID(),target_allocation_id:obsolete.id,cash_role:'payer',target_account_id:aw,supplied_cash_amount_minor:100})
  const before=await facts(a.client);expect(await balance(a.client,aw)).toBe(9700);expect(await balance(b.client,bw)).toBe(25300)
  await signIn(page,a.account);await page.goto('/profile/fresh-start');await page.getByRole('button',{name:'Review Fresh Start',exact:true}).click();await page.getByRole('button',{name:'Review opening balances',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByText(/old Split balances in both directions are cleared/)).toBeVisible();await page.getByRole('button',{name:'Yes, start new personal ledger',exact:true}).click();await expect(page.getByText('Your new personal ledger is ready',{exact:true})).toBeVisible()
  expect(await facts(a.client)).toEqual(before);expect((await rpc(a.client,'get_direct_outstanding',{target_counterparty_id:b.owner,currency_code:'MYR'})).amount_minor).toBe(0)
  const afterResetCash=await cashFacts(a.client),bCash=await cashFacts(b.client)
  expect((await rpc(a.client,'preview_personal_fresh_start')).accounts.every((unit:{opening_locked:boolean})=>!unit.opening_locked)).toBe(true)
  await expect(rpc(b.client,'authorize_personal_settlement_cash_leg',{request_id:randomUUID(),target_allocation_id:obsolete.id,cash_role:'receiver',target_account_id:bw,supplied_cash_amount_minor:100})).rejects.toMatchObject({message:'shared_split_cleared'})

  await page.goto('/');await expect(page.getByTestId('home-payable')).toHaveAttribute('data-empty','true');await expect(page.getByTestId('home-record')).toHaveCount(0)
  await signIn(otherPage,b.account)
  const{data:person,error:personError}=await b.client.from('person_relationships').select('id').eq('linked_participant_id',a.owner).single();if(personError)throw personError
  await otherPage.goto('/person/'+person.id)
  const removableActions=otherPage.locator(`[data-expense-id="${removable}"]`);await expect(removableActions).toBeVisible();await removableActions.getByRole('button',{name:'Remove from my records',exact:true}).click();await expect(removableActions).toHaveCount(0)
  const originalActions=otherPage.locator(`[data-expense-id="${original}"]`);await originalActions.getByRole('button',{name:/^Tag again/}).click();await expect(originalActions.getByRole('button',{name:/^Tag again/})).toHaveCount(0)
  const{data:retag,error:retagError}=await a.client.from('shared_restart_retags').select('id,expense_version,amount_minor').eq('expense_id',original).eq('state','pending').single();if(retagError)throw retagError;expect(Number(retag.amount_minor)).toBe(700)
  expect((await rpc(a.client,'get_direct_outstanding',{target_counterparty_id:b.owner,currency_code:'MYR'})).amount_minor).toBe(0)
  await page.goto('/?notice=retag&target='+retag.id);await page.getByRole('button',{name:'Accept split',exact:true}).click();await expect(page.getByRole('button',{name:'Accept split',exact:true})).toHaveCount(0)
  expect((await rpc(a.client,'get_direct_outstanding',{target_counterparty_id:b.owner,currency_code:'MYR'})).signed_outstanding_minor).toBe(700)
  await rpc(a.client,'respond_shared_split_retag',{target_request_id:retag.id,response:'accepted',expected_expense_version:retag.expense_version})
  expect(await facts(a.client)).toEqual(before);expect(await cashFacts(a.client)).toEqual(afterResetCash);expect(await cashFacts(b.client)).toEqual(bCash)
  await pay(700,700);expect(await balance(a.client,aw)).toBe(9000);expect(await balance(b.client,bw)).toBe(26000);expect((await rpc(a.client,'get_direct_outstanding',{target_counterparty_id:b.owner,currency_code:'MYR'})).amount_minor).toBe(0)
  const{count,error:countError}=await b.client.from('expenses').select('id',{count:'exact',head:true});if(countError)throw countError;expect(count).toBe(2)
 }finally{await a.client.auth.signOut();await b.client.auth.signOut();await otherContext.close()}
})

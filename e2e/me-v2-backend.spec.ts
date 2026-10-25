import {randomUUID} from 'node:crypto'
import {createClient,type SupabaseClient} from '@supabase/supabase-js'
import {test,expect} from '@playwright/test'
import {createConfirmedAccount,signIn,seedLocalInsightsDisplayFx} from './fixtures/localSupabase'
const anon='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
async function rpc(client:SupabaseClient,name:string,args:Record<string,unknown>={}){const{data,error}=await client.rpc(name,args);if(error)throw error;return data}
async function session(label:string){
 const account=await createConfirmedAccount(label,'Me Backend Tester',randomUUID())
 const client=createClient('http://127.0.0.1:54321',anon,{auth:{persistSession:false,autoRefreshToken:false}})
 const{error}=await client.auth.signInWithPassword({email:account.email,password:account.password});if(error)throw error
 const owner=await rpc(client,'current_participant_id') as string
 return{account,client,owner}
}
const today=new Date().toISOString().slice(0,10)
async function wallet(s:Awaited<ReturnType<typeof session>>,name:string,currency='MYR',amount=10000){return(await rpc(s.client,'create_personal_account',{request_id:randomUUID(),account_name:name,account_type:'bank',currency_code:currency,opening_balance_minor:amount,balance_as_of:today,make_default:false})).account_id as string}
async function facts(client:SupabaseClient){
 const result:Record<string,unknown>={}
 for(const table of ['expenses','expense_participations','payer_contributions','expense_shares','settlement_payments','settlement_allocations','settlement_attribution_intents','personal_settlement_cash_legs']){
  const{data,error}=await client.from(table).select('*');if(error)throw error
  result[table]=data.map(r=>JSON.stringify(r)).sort()
 }
 return result
}
test('real isolated backend: Fresh Start preserves shared cash/partial/pending settlements and native balances; personal archive drives active records',async({page})=>{
 test.setTimeout(150_000)
 const s=await session('me-period'),other=await session('me-period-other')
 try{
  const cash=await wallet(s,'Period MYR'),vnd=await wallet(s,'Period VND','VND',-90000),otherCash=await wallet(other,'Other MYR')
  const invite=await rpc(s.client,'create_friend_invite');await rpc(other.client,'accept_friend_invite',{raw_token:invite})
  const expense=await rpc(s.client,'create_expense_with_multicurrency_funding',{request_id:randomUUID(),expense_payload:{expense_scope:'personal',total_minor:1000,currency_code:'MYR',description:'Archived ordinary expense',category:'Food',occurred_on:today,participant_ids:[s.owner],contribution_amounts:[1000],share_amounts:[1000]},funding_plan:{mode:'deferred',primary_account_id:cash,legs:[]}})
  const shared=await rpc(s.client,'create_expense',{request_id:randomUUID(),expense_scope:'direct',target_space_id:null,total_minor:1800,currency_code:'MYR',description:'Protected actual shared bill',category:'Food',occurred_on:today,participant_ids:[s.owner,other.owner],contribution_amounts:[1800,0],share_amounts:[900,900]})
  await rpc(other.client,'respond_to_direct_expense',{target_expense_id:shared,response:'accepted',expected_expense_version:1})
  for(const [amount,expected,accepted]of [[300,900,true],[200,600,false]]as const){
   const payment=await rpc(other.client,'propose_settlement',{request_id:randomUUID(),settlement_scope:'direct',target_space_id:null,currency_code:'MYR',total_amount_minor:amount,payment_date:today,creditor_ids:[s.owner],allocation_amounts:[amount],settlement_note:'Continuing settlement',overpay_disposition:null,expected_outstanding_minor:expected,selected_expense_ids:[shared],attribution_amounts:[amount],source_payment_request_id:null})
   const{data:allocation,error}=await s.client.from('settlement_allocations').select('id').eq('settlement_payment_id',payment).single();if(error)throw error
   await rpc(other.client,'authorize_personal_settlement_cash_leg',{request_id:randomUUID(),target_allocation_id:allocation.id,cash_role:'payer',target_account_id:otherCash,supplied_cash_amount_minor:amount})
   if(accepted){await rpc(s.client,'authorize_personal_settlement_cash_leg',{request_id:randomUUID(),target_allocation_id:allocation.id,cash_role:'receiver',target_account_id:cash,supplied_cash_amount_minor:amount});await rpc(s.client,'respond_to_settlement',{target_allocation_id:allocation.id,response:'accepted',expected_payment_version:1})}
  }
  const before=await facts(s.client),otherBefore=await facts(other.client),owed=await rpc(s.client,'get_direct_outstanding',{target_counterparty_id:other.owner,currency_code:'MYR'})
  const unitsBefore=(await rpc(s.client,'get_personal_multicurrency_accounts')).accounts.map((a:{id:string;entry_sum_minor:string})=>({id:a.id,balance:a.entry_sum_minor}))
  await signIn(page,s.account);await page.goto('/profile/fresh-start');await page.getByRole('button',{name:'Review Fresh Start',exact:true}).click();await page.getByRole('button',{name:'Review opening balances',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('Current password',{exact:true}).fill(s.account.password);await page.getByRole('button',{name:'Verify sign-in',exact:true}).click();await expect(page.getByText(/Sign-in verified/)).toBeVisible();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Start new personal ledger',exact:true}).click();await expect(page.getByText('Your new personal ledger is ready',{exact:true})).toBeVisible({timeout:15000})
  expect(await facts(s.client)).toEqual(before);expect(await facts(other.client)).toEqual(otherBefore);expect(await rpc(s.client,'get_direct_outstanding',{target_counterparty_id:other.owner,currency_code:'MYR'})).toEqual(owed)
  expect((await rpc(s.client,'get_personal_multicurrency_accounts')).accounts.map((a:{id:string;entry_sum_minor:string})=>({id:a.id,balance:a.entry_sum_minor}))).toEqual(unitsBefore)
  expect((await s.client.auth.getUser()).data.user?.id).toBe(s.account.userId);expect(await rpc(s.client,'current_participant_id')).toBe(s.owner)
  const periods=await rpc(s.client,'get_personal_ledger_period_state');expect(periods.archived_expense_ids).toContain(expense.expense_id);expect(periods.archived_expense_ids).not.toContain(shared);expect(periods.periods.filter((p:{status:string})=>p.status==='active')).toHaveLength(1)
  await page.getByRole('button',{name:'View archived ledger',exact:true}).click();await expect(page.getByText('Archived ordinary expense',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Edit|Delete/})).toHaveCount(0)
  seedLocalInsightsDisplayFx();await page.goto('/insights/records?month='+today.slice(0,7)+'&scope=personal');await expect(page.locator('.i-record-row')).toHaveCount(0);await expect(page.getByText('Archived ordinary expense',{exact:true})).toHaveCount(0)
  const denied=await other.client.rpc('get_personal_ledger_archive',{p_period_id:periods.periods.find((p:{status:string})=>p.status==='archived').id});expect(denied.error?.message).toBe('personal_archive_unavailable')
  expect(vnd).toBeTruthy()
 }finally{await s.client.auth.signOut();await other.client.auth.signOut()}
})
test('real isolated backend: profile, language persistence and explicit password manager retain the original principal',async({page})=>{
 const s=await session('me-settings')
 try{
  await signIn(page,s.account);await page.goto('/profile');await expect(page.getByRole('textbox')).toHaveCount(0);await page.locator('.me-profile').click();await page.getByRole('textbox',{name:'Display name',exact:true}).fill('New paper display name');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Changes saved.');const profile=await s.client.from('user_profiles').select('display_name').eq('id',s.account.userId).single();expect(profile.data?.display_name).toBe('New paper display name');expect(await rpc(s.client,'current_participant_id')).toBe(s.owner)
  await page.goto('/profile');await page.getByRole('button',{name:/Language.*English/}).click();await page.getByRole('button',{name:'简体中文',exact:true}).click();await page.reload();await expect(page.getByRole('heading',{name:'我的',exact:true})).toBeVisible();await page.getByRole('button',{name:/语言/}).click();await page.getByRole('button',{name:'English',exact:true}).click();await page.getByRole('button',{name:'Sign-in & security',exact:false}).click();await expect(page.getByRole('textbox')).toHaveCount(0);await expect(page.getByRole('button',{name:/Password/})).toBeVisible()
 }finally{await s.client.auth.signOut()}
})

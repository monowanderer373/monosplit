import {randomUUID} from 'node:crypto'
import {createClient,type SupabaseClient} from '@supabase/supabase-js'
import {expect,test} from '@playwright/test'
import {createConfirmedAccount,signIn,type FixtureAccount} from './fixtures/localSupabase'
const anon='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
async function normalClient(account:FixtureAccount){
 const client=createClient('http://127.0.0.1:54321',anon,{auth:{persistSession:false,autoRefreshToken:false}})
 const {error}=await client.auth.signInWithPassword({email:account.email,password:account.password});if(error)throw error
 return client
}
async function rpc(client:SupabaseClient,name:string,args:Record<string,unknown>={}){const {data,error}=await client.rpc(name,args);if(error)throw error;return data}
async function seed(label:string){
 const account=await createConfirmedAccount(label,'Notification tester',randomUUID()),client=await normalClient(account),owner=await rpc(client,'current_participant_id')
 const bank=await rpc(client,'create_personal_account',{request_id:randomUUID(),account_name:'Notification bank',account_type:'bank',currency_code:'MYR',opening_balance_minor:100000,balance_as_of:'2026-10-14',make_default:false})
 const wallet=await rpc(client,'create_personal_account',{request_id:randomUUID(),account_name:'Touch n Go test',account_type:'ewallet',currency_code:'MYR',opening_balance_minor:-1250,balance_as_of:'2026-10-14',make_default:false})
 const tasks=[]
 for(const [description,currency,total]of [['Train ticket notification','MYR',125],['Dinner notification','VND',90000]]as const){
  const id=await rpc(client,'create_expense',{request_id:randomUUID(),expense_scope:'personal',target_space_id:null,total_minor:total,currency_code:currency,description,category:'Food',occurred_on:'2026-10-14',participant_ids:[owner],contribution_amounts:[total],share_amounts:[total]})
  const funding=await rpc(client,'link_expense_funding',{request_id:randomUUID(),target_expense_id:id,target_account_id:null,supplied_account_amount_minor:null})
  tasks.push({expense:id,funding:funding.funding_intent_id})
 }
 return {account,client,owner,bank:bank.account_id,wallet:wallet.account_id,tasks}
}
test('real isolated DB: two debit targets, exact cross-currency completion, immutable expense, one private journal and warning resolution',async({page})=>{
 test.setTimeout(120_000)
 const s=await seed('notification-closure'),before=await s.client.from('expenses').select('id,total_minor,currency,version,status').order('id');expect(before.error).toBeNull()
 try{
  await signIn(page,s.account);const bell=page.getByTestId('home-account-notice');await expect(bell).toHaveAccessibleName(/2 to do/)
  for(const [index,label,value]of [[0,'Train ticket notification','1.25'],[1,'Dinner notification','12.34']]as const){
   await bell.click();await page.getByTestId('home-notice-popover').getByRole('button',{name:new RegExp(label)}).click();const target=page.getByTestId('notification-target');await expect(page).toHaveURL(new RegExp('target='+s.tasks[index].funding));await expect(target.getByRole('heading',{name:label})).toBeVisible();await target.getByRole('combobox').selectOption(s.bank)
   if(index===0)await expect(target.getByRole('textbox')).toHaveValue(value)
   else{await expect(target).toContainText('Reference exchange rates are not used');await expect(target.getByRole('textbox')).toHaveValue('');await target.getByRole('textbox').fill(value)}
   await target.getByRole('button',{name:'Complete debit'}).dblclick();await expect(target).toContainText('already been handled');await expect(target.getByRole('button',{name:'Complete debit'})).toHaveCount(0)
   const intents=await s.client.from('personal_funding_intents').select('status,account_amount_minor,account_currency').eq('id',s.tasks[index].funding).single();expect(intents.error).toBeNull();expect(intents.data).toEqual({status:'posted',account_amount_minor:index===0?125:1234,account_currency:'MYR'})
   const journal=await s.client.from('personal_account_transactions').select('id').eq('expense_id',s.tasks[index].expense).eq('kind','expense_funding');expect(journal.error).toBeNull();expect(journal.data).toHaveLength(1)
   await page.keyboard.press('Escape');await expect(target).toHaveCount(0);await expect(bell).toBeFocused();await expect(bell).toHaveAccessibleName(new RegExp(`${1-index} to do`))
  }
  const after=await s.client.from('expenses').select('id,total_minor,currency,version,status').order('id');expect(after.data).toEqual(before.data)
  await bell.click();await page.getByRole('tab',{name:'Activity'}).click();await page.getByRole('button',{name:/Touch n Go test/}).click();await expect(page.getByTestId('notification-target')).toContainText('12.50')
  await rpc(s.client,'create_income_transaction',{request_id:randomUUID(),target_account_id:s.wallet,amount_minor:2500,occurred_on:'2026-10-14',transaction_memo:'Isolated warning resolution'})
  await page.reload();await expect(page.getByTestId('notification-target')).toContainText('already been handled');await expect(page.getByTestId('notification-target')).toContainText('12.50');await page.keyboard.press('Escape');await expect(page.getByTestId('notification-target')).toHaveCount(0);await bell.click();await page.getByRole('tab',{name:'Activity'}).click();await expect(page.getByRole('button',{name:/Touch n Go test/})).toHaveCount(0)
 }finally{await s.client.auth.signOut()}
})
test('real isolated DB: login restores intent; another device completes it; another identity cannot access it or submit an old action',async({page})=>{
 test.setTimeout(120_000)
 const s=await seed('notification-permission'),other=await createConfirmedAccount('notification-other','Other tester',randomUUID()),otherClient=await normalClient(other)
 try{
  const intent=`/?notice=funding&target=${s.tasks[0].funding}`
  await page.goto(intent);await page.getByRole('button',{name:'Sign in',exact:true}).click();expect(new URL(page.url()).searchParams.get('redirect')).toBe(intent)
  await signIn(page,s.account,intent);const target=page.getByTestId('notification-target');await expect(target.getByRole('combobox')).toBeVisible()
  await rpc(s.client,'complete_pending_funding',{request_id:randomUUID(),target_funding_intent_id:s.tasks[0].funding,target_account_id:s.bank,account_amount_minor:125})
  // Fresh direct intent lookup, not an event arrival, establishes completion.
  await page.reload();await expect(target).toContainText('already been handled');await expect(target.getByRole('button',{name:'Complete debit'})).toHaveCount(0)
  const denied=await otherClient.from('personal_funding_intents').select('id').eq('id',s.tasks[0].funding);expect(denied.error).toBeNull();expect(denied.data).toEqual([])
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await signIn(page,other,intent);await expect(target).toContainText('no longer available');await expect(target.getByRole('button',{name:'Complete debit'})).toHaveCount(0)
 }finally{await s.client.auth.signOut();await otherClient.auth.signOut()}
})

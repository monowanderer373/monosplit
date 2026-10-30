import {randomUUID}from 'node:crypto'
import {createClient,type SupabaseClient}from '@supabase/supabase-js'
import {test,expect}from '@playwright/test'
import {createConfirmedAccount,openAuthenticatedBrowser,type FixtureAccount}from './fixtures/localSupabase'
// Use the existing public disposable-stack key. No production URL or credentials accepted.
const key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
async function client(user:FixtureAccount){const c=createClient('http://127.0.0.1:54321',key,{auth:{persistSession:false,autoRefreshToken:false}});const{error}=await c.auth.signInWithPassword({email:user.email,password:user.password});if(error)throw error;return c}
async function rpc(c:SupabaseClient,name:string,args:Record<string,unknown>={}){const{data,error}=await c.rpc(name,args);if(error)throw new Error(error.message);return data}
async function facts(c:SupabaseClient){const snapshot:Record<string,unknown>={};for(const table of['expenses','expense_participations','payer_contributions','expense_shares','settlement_payments','settlement_allocations','personal_account_entries','personal_account_transactions','personal_money_movements']){const{data,error}=await c.from(table).select('*');if(error)throw error;snapshot[table]=data.map(r=>JSON.stringify(r)).sort()}return snapshot}

test('real nonfriend invitation, original role/manual/remove services, revalidation and immutable history',async({browser})=>{
 test.setTimeout(180000)
 const run=randomUUID(),a=await createConfirmedAccount('members-a','Owner',run),b=await createConfirmedAccount('members-b','Invited without friendship',run),ac=await client(a),bc=await client(b)
 const owner=await rpc(ac,'current_participant_id'),other=await rpc(bc,'current_participant_id'),id=await rpc(ac,'create_space',{space_type:'trip',space_name:'Members isolated trip',start_date:null,end_date:null,default_currency:'MYR'})
 const token=await rpc(ac,'create_space_invite',{target_space_id:id,invite_role:'view'});await rpc(bc,'accept_space_invite',{raw_token:token})
 const{data:people,error:peopleError}=await ac.from('person_relationships').select('id').eq('linked_participant_id',other);if(peopleError)throw peopleError;expect(people).toEqual([])
 const aa=await openAuthenticatedBrowser(browser,a),bb=await openAuthenticatedBrowser(browser,b)
 try{
  await aa.page.goto('/space/'+id+'/members');await bb.page.goto('/space/'+id+'/members')
  await expect(aa.page.locator('.tm-row')).toHaveCount(2);await expect(bb.page.locator('.tm-row')).toHaveCount(2);await expect(aa.page.locator('.tm-list')).toContainText(b.displayName)
  await expect(bb.page.getByRole('button',{name:'Invite',exact:true})).toHaveCount(0);await expect(bb.page.getByRole('button',{name:'Add untracked member',exact:true})).toHaveCount(0)
  await expect(rpc(bc,'add_manual_space_member',{target_space_id:id,display_name:'Forbidden'})).rejects.toThrow('space_write_denied')
  await expect(rpc(bc,'update_space_member_role',{target_space_id:id,target_participant_id:owner,member_role:'view'})).rejects.toThrow('owner_required')
  await aa.page.getByRole('button',{name:'Manage '+b.displayName,exact:true}).click();await aa.page.getByRole('button',{name:'Full access',exact:true}).click();await expect(aa.page.locator(`[data-participant-id="${other}"]`)).toContainText('Full access')
  await bb.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(bb.page.getByRole('button',{name:'Add untracked member',exact:true})).toBeVisible()
  await bb.page.getByRole('button',{name:'Add untracked member',exact:true}).click();await bb.page.getByRole('textbox').fill('Same name');await bb.page.getByRole('button',{name:'Add untracked member',exact:true}).click();await expect(bb.page.locator('.tm-row')).toHaveCount(3)
  await rpc(ac,'add_manual_space_member',{target_space_id:id,display_name:'Same name'});await aa.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(aa.page.locator('.tm-row')).toHaveCount(4);await expect(aa.page.locator('.tm-person strong').filter({hasText:'Same name'})).toHaveCount(2)
  await rpc(ac,'create_expense',{request_id:randomUUID(),expense_scope:'space',target_space_id:id,total_minor:1000,currency_code:'MYR',description:'Preserved membership history',category:'Food',occurred_on:new Date().toISOString().slice(0,10),participant_ids:[owner,other],contribution_amounts:[1000,0],share_amounts:[500,500]});
  const payment=await rpc(bc,'propose_settlement',{request_id:randomUUID(),settlement_scope:'space',target_space_id:id,currency_code:'MYR',total_amount_minor:200,payment_date:new Date().toISOString().slice(0,10),creditor_ids:[owner],allocation_amounts:[200],settlement_note:'Preserved accepted history',overpay_disposition:null,expected_outstanding_minor:500,selected_expense_ids:null,attribution_amounts:null,source_payment_request_id:null});
  const{data:allocation,error:allocationError}=await ac.from('settlement_allocations').select('id').eq('settlement_payment_id',payment).single();if(allocationError)throw allocationError;
  const date=new Date().toISOString().slice(0,10),cashAccount=async(c:SupabaseClient,name:string)=>(await rpc(c,'create_personal_account',{request_id:randomUUID(),account_name:name,account_type:'bank',currency_code:'MYR',opening_balance_minor:10000,balance_as_of:date,make_default:false})).account_id;
  const payer=await cashAccount(bc,'Isolated member account'),receiver=await cashAccount(ac,'Isolated owner account');
  await rpc(bc,'authorize_personal_settlement_cash_leg',{request_id:randomUUID(),target_allocation_id:allocation.id,cash_role:'payer',target_account_id:payer,supplied_cash_amount_minor:200});
  await rpc(ac,'authorize_personal_settlement_cash_leg',{request_id:randomUUID(),target_allocation_id:allocation.id,cash_role:'receiver',target_account_id:receiver,supplied_cash_amount_minor:200});
  await rpc(ac,'respond_to_settlement',{target_allocation_id:allocation.id,response:'accepted',expected_payment_version:1});
  const before=await facts(ac)
  await aa.page.getByRole('button',{name:'Manage '+b.displayName,exact:true}).click();await aa.page.getByRole('button',{name:'Remove member',exact:true}).click();await aa.page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(aa.page.locator('.tm-row')).toHaveCount(4)
  await aa.page.getByRole('button',{name:'Manage '+b.displayName,exact:true}).click();await aa.page.getByRole('button',{name:'Remove member',exact:true}).click();await aa.page.getByRole('button',{name:'Remove',exact:true}).click();await expect(aa.page.locator('.tm-row')).toHaveCount(3)
  await bb.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(bb.page.getByText('This trip is unavailable',{exact:true})).toBeVisible();await expect(bb.page.locator('.tm-row')).toHaveCount(0);expect(await facts(ac)).toEqual(before)
  await aa.page.getByRole('button',{name:'Trip',exact:true}).click();await expect(aa.page.getByTestId('trip-ledger-members')).toContainText('3 members');await aa.page.getByTestId('trip-ledger-members').click();await expect(aa.page.locator('.tm-row')).toHaveCount(3);
  const second=await rpc(ac,'create_space',{space_type:'trip',space_name:'Leave own membership',start_date:null,end_date:null,default_currency:'MYR'});const secondToken=await rpc(ac,'create_space_invite',{target_space_id:second,invite_role:'full_access'});await rpc(bc,'accept_space_invite',{raw_token:secondToken});
  await bb.page.goto('/space/'+second+'/members');await expect(bb.page.locator('.tm-row')).toHaveCount(2);await bb.page.getByRole('button',{name:'Manage You',exact:true}).click();await bb.page.getByRole('button',{name:'Leave',exact:true}).click();await bb.page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(bb.page.locator('.tm-row')).toHaveCount(2);
  await bb.page.getByRole('button',{name:'Manage You',exact:true}).click();await bb.page.getByRole('button',{name:'Leave',exact:true}).click();await bb.page.getByRole('button',{name:'Leave',exact:true}).click();await expect(bb.page).toHaveURL(/\/shared\?tab=trips$/);expect(await facts(ac)).toEqual(before);
  const{data:principal,error}=await bc.from('participants').select('id').eq('id',other).single();if(error)throw error;expect(principal.id).toBe(other)
 }finally{await aa.context.close();await bb.context.close();await ac.auth.signOut();await bc.auth.signOut()}
})

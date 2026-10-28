import {randomUUID}from'node:crypto'
import {createClient,type SupabaseClient}from'@supabase/supabase-js'
import {test,expect}from'@playwright/test'
import {createConfirmedAccount,openAuthenticatedBrowser,type FixtureAccount}from'./fixtures/localSupabase'
import {enterQuickAmount}from'./fixtures/quickAdd'
const anon='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
async function client(user:FixtureAccount){const c=createClient('http://127.0.0.1:54321',anon,{auth:{persistSession:false,autoRefreshToken:false}});const{error}=await c.auth.signInWithPassword(user);if(error)throw error;return c}
async function rpc(c:SupabaseClient,name:string,args:Record<string,unknown>={}){const{data,error}=await c.rpc(name,args);if(error)throw Error(error.message);return data}
async function read(c:SupabaseClient,table:string){const{data,error}=await c.from(table).select('*');if(error)throw error;return data.map(row=>JSON.stringify(row)).sort()}
async function facts(c:SupabaseClient){return Object.fromEntries(await Promise.all(['expenses','expense_participations','expense_shares','payer_contributions','settlement_payments','settlement_allocations','personal_account_entries','personal_account_transactions','personal_money_movements','personal_funding_bundle_legs'].map(async t=>[t,await read(c,t)])))}
test('nonfriend Travel capture, payer-only correction, explicit friend consent and unchanged financial history',async({browser})=>{
 test.setTimeout(240000)
 const run=randomUUID(),a=await createConfirmedAccount('split-owner','Owner Alpha',run),b=await createConfirmedAccount('split-invited','Invited Beta',run),c=await createConfirmedAccount('split-view','Viewer Gamma',run),ac=await client(a),bc=await client(b),cc=await client(c)
 const aid=await rpc(ac,'current_participant_id'),bid=await rpc(bc,'current_participant_id'),cid=await rpc(cc,'current_participant_id'),sid=await rpc(ac,'create_space',{space_type:'trip',space_name:'Trip complete consumers',start_date:null,end_date:null,default_currency:'MYR'})
 for(const[actor,role]of[[bc,'full_access'],[cc,'view']]as const){const token=await rpc(ac,'create_space_invite',{target_space_id:sid,invite_role:role});await rpc(actor,'accept_space_invite',{raw_token:token})}
 expect(await read(ac,'friendships')).toEqual([])
 const aa=await openAuthenticatedBrowser(browser,a),bb=await openAuthenticatedBrowser(browser,b)
 try{
  const page=bb.page;await page.getByRole('button',{name:'Travel',exact:true}).click();await expect(page.getByTestId('home-trip-selector')).toContainText('Trip complete consumers');await page.getByRole('button',{name:'Quick add expense',exact:true}).click()
  const quick=page.getByRole('dialog',{name:'Quick Add',exact:true});await expect(quick.getByTestId('quick-add-ledger')).toContainText('Trip complete consumers');await quick.getByRole('button',{name:'Food',exact:true}).click();await enterQuickAmount(quick,'1000');await quick.getByRole('button',{name:'Split expense',exact:true}).click()
  const split=page.getByRole('dialog',{name:'Split expense',exact:true});await expect(split.getByRole('checkbox',{name:'You',exact:true})).toBeChecked();await expect(split.getByRole('checkbox',{name:a.displayName,exact:true})).not.toBeChecked();await expect(split.getByRole('checkbox',{name:c.displayName,exact:true})).not.toBeChecked()
  await split.getByRole('checkbox',{name:a.displayName,exact:true}).check();await split.getByRole('checkbox',{name:'You',exact:true}).click();await split.getByRole('button',{name:'Change consumers',exact:true}).click();await split.getByRole('button',{name:'Apply split',exact:true}).click();await quick.getByRole('button',{name:'Save and close',exact:true}).click();await expect(quick).toHaveCount(0)
  const{data:original,error}=await ac.from('expenses').select('id,version').eq('space_id',sid).single();if(error)throw error
  const{data:parts}=await ac.from('expense_participations').select('id,participant_id').eq('expense_id',original.id)
  const{data:shares}=await ac.from('expense_shares').select('expense_participation_id,amount_minor').eq('expense_id',original.id)
  const participation=(id:string)=>parts!.find(p=>p.participant_id===id)!.id
  expect(shares!.find(s=>s.expense_participation_id===participation(bid))!.amount_minor).toBe(0);expect(shares!.find(s=>s.expense_participation_id===participation(aid))!.amount_minor).toBe(100000)
  await aa.page.goto('/space/'+sid);await aa.page.getByRole('button',{name:'Edit Food',exact:true}).click();await aa.page.getByRole('button',{name:'Split details',exact:true}).click()
  const edit=aa.page.getByRole('dialog',{name:'Split expense',exact:true});await expect(edit.getByRole('checkbox',{name:c.displayName,exact:true})).not.toBeChecked();await edit.getByRole('checkbox',{name:c.displayName,exact:true}).check();await edit.getByRole('button',{name:'Equally',exact:true}).click();await edit.getByRole('button',{name:'Apply split',exact:true}).click();await expect(aa.page.getByTestId('expense-edit-review')).toContainText('500.00');await aa.page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(aa.page.getByRole('button',{name:'Save changes',exact:true})).toHaveCount(0)
  const{data:replacement,error:replacementError}=await ac.from('expenses').select('id,corrects_expense_id').eq('corrects_expense_id',original.id).single();if(replacementError)throw replacementError;expect(replacement.corrects_expense_id).toBe(original.id)
  const{data:old}=await ac.from('expenses').select('status,total_minor').eq('id',original.id).single();expect(old).toMatchObject({status:'voided',total_minor:100000})
  const beforeA=await facts(ac),beforeB=await facts(bc)
  await aa.page.goto('/space/'+sid+'/members');await aa.page.getByRole('button',{name:'Add '+b.displayName+' as a friend',exact:true}).click();await expect(aa.page.locator(`[data-participant-id="${bid}"]`)).toContainText('Sent');expect(await read(ac,'friendships')).toEqual([])
  const{data:requests,error:requestError}=await ac.from('trip_friend_requests').select('id').eq('target_id',bid).eq('status','pending');if(requestError)throw requestError;expect(requests).toHaveLength(1)
  await bb.page.goto('/shared?view=review');const incoming=bb.page.getByTestId('friend-request-review');await expect(incoming).toHaveCount(1);await expect(incoming).toContainText(a.displayName);await incoming.getByRole('button',{name:'Accept',exact:true}).click();await expect(incoming).toHaveCount(0)
  await aa.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(aa.page.locator(`[data-participant-id="${bid}"]`)).toContainText('Friend')
  for(const actor of[ac,bc]){const relationships=await read(actor,'person_relationships');expect(relationships).toHaveLength(1);expect((await read(actor,'friendships'))[0]).toContain('accepted')}
  await bb.page.goto('/shared');await expect(bb.page.getByRole('button',{name:new RegExp(a.displayName)})).toBeVisible();expect(await facts(ac)).toEqual(beforeA);expect(await facts(bc)).toEqual(beforeB)
  // Friendship did not replace the Trip's complete member source or change historical principals.
  await bb.page.goto('/space/'+sid+'/members');await expect(bb.page.locator('.tm-row')).toHaveCount(3);expect(cid).not.toBe(aid)
 }finally{await aa.context.close();await bb.context.close();for(const actor of[ac,bc,cc])await actor.auth.signOut()}
})

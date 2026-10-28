import {test,expect,type Page}from'@playwright/test'
import {mkdir}from'node:fs/promises'
import {setupMulticurrency}from'./fixtures/multicurrency'
import {enterQuickAmount}from'./fixtures/quickAdd'
const exceptions=new WeakMap<Page,string[]>()
test.beforeEach(({page})=>{const errors:string[]=[];exceptions.set(page,errors);page.on('pageerror',error=>errors.push(error.name))})
test.afterEach(({page})=>{expect(exceptions.get(page)).toEqual([])})
const id='00000000-0000-4000-8000-000000000101'
async function setup(page:Page,lang='en'){
 await setupMulticurrency(page,{lang})
 const names:Record<string,string>={owner:'You',alex:'Alex Tan',mia:'Mia Lee'}
 const state={names,tripName:'Hanoi Trip',statuses:{alex:'available',mia:'incoming'}as Record<string,string>,writes:[]as string[],responses:[]as string[],fail:false}
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const p=new URL(route.request().url()).pathname,body=route.request().method()==='POST'?route.request().postDataJSON():null
  if(p.endsWith('/auth/v1/user'))return route.fulfill({json:{id:'ui-contract-user',aud:'authenticated',role:'authenticated',is_anonymous:false,email:'fixture@example.test',user_metadata:{}}})
  if(p.endsWith('/rpc/current_participant_id'))return route.fulfill({json:'owner'})
  if(p.endsWith('/space_members')){
   if(new URL(route.request().url()).searchParams.get('select')?.includes('spaces('))return route.fulfill({json:[{role:'owner',spaces:{id,type:'trip',name:state.tripName,owner_participant_id:'owner',status:'active',default_currency:'MYR',version:1,start_date:null,end_date:null,created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'}}]})
   return route.fulfill({json:Object.entries(names).map(([participant,name])=>({space_id:id,participant_id:participant,role:participant==='owner'?'owner':participant==='mia'?'view':'full_access',joined_at:'2026-10-01T00:00:00Z',removed_at:null,participants:{id:participant,kind:'account',display_name:name,auth_user_id:participant,created_by:null}}))})
  }
  if(p.endsWith('/rpc/get_trip_friend_states'))return route.fulfill({json:Object.entries(state.statuses).map(([participantId,value])=>({participantId,state:value,requestId:value==='incoming'?'incoming-request':value==='sent'?'sent-request':null,version:1}))})
  if(p.endsWith('/trip_friend_requests')||p.endsWith('/rpc/get_pending_trip_friend_requests'))return route.fulfill({json:state.statuses.mia==='incoming'?[{id:'incoming-request',sender_id:'mia',target_id:'owner',source_name:'Hanoi Trip',sender_name:'Mia Lee',target_name:'You',status:'pending',version:1,canAccept:true,expires_at:'2099-01-01T00:00:00Z'}]:[]})
  if(p.endsWith('/rpc/send_trip_friend_request')){state.writes.push(body.command_id);state.statuses[body.target_participant_id]='sent';return state.fail?route.fulfill({status:503,json:{message:'Synthetic unknown response'}}):route.fulfill({json:'sent-request'})}
  if(p.endsWith('/rpc/respond_trip_friend_request')){state.responses.push(body.response);state.statuses[body.target_request_id==='incoming-request'?'mia':'alex']=body.response==='accepted'?'friend':'available';return route.fulfill({json:null})}
  return route.fallback()
 })
 return state
}
async function shot(page:Page,name:string){await mkdir('test-results/trip-split',{recursive:true});await page.screenshot({path:'test-results/trip-split/'+name+'.png',animations:'disabled'})}
for(const width of[320,360,390,430])test(`Trip consumers retain independent payments and applied/cancelled drafts at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:844});await page.goto('/space/'+id+'/members');await expect(page.locator('.tm-row')).toHaveCount(3)
 await expect(page.getByRole('button',{name:'Add Alex Tan as a friend',exact:true})).toBeVisible();await shot(page,'members-'+width)
 await page.getByRole('button',{name:'Quick add expense',exact:true}).click();const quick=page.getByRole('dialog',{name:'Quick Add',exact:true});await quick.getByRole('button',{name:'Food',exact:true}).click();await enterQuickAmount(quick,'1000');await quick.getByRole('button',{name:'Split expense',exact:true}).click()
 const split=page.getByRole('dialog',{name:'Split expense',exact:true});await expect(split.getByRole('checkbox',{name:'You',exact:true})).toBeChecked();await expect(split.getByRole('checkbox',{name:'Alex Tan',exact:true})).not.toBeChecked();await expect(split.getByRole('checkbox',{name:'Mia Lee',exact:true})).not.toBeChecked();await expect(split.getByRole('button',{name:'Edit people',exact:true})).toHaveCount(0);expect(await split.getByRole('checkbox',{name:'You',exact:true}).evaluate(el=>getComputedStyle(el).borderRadius)).toBe('5px');await shot(page,'only-self-'+width)
 await split.getByRole('button',{name:'Select all',exact:true}).click();await split.getByRole('button',{name:/Paid by You/}).click();await split.getByRole('textbox',{name:'Paid by You',exact:true}).fill('600');await split.getByRole('textbox',{name:'Paid by Mia Lee',exact:true}).fill('400')
 await split.getByRole('checkbox',{name:'Mia Lee',exact:true}).click();await split.getByRole('button',{name:'Change consumers',exact:true}).click();await expect(split.getByRole('textbox',{name:'Paid by Mia Lee',exact:true})).toHaveValue('400');await expect(split.getByRole('textbox',{name:'Paid by You',exact:true})).toHaveValue('600');await shot(page,'payer-only-'+width)
 await split.getByRole('button',{name:'Apply split',exact:true}).click();await expect(split).toHaveCount(0)
 await quick.getByRole('button',{name:'Split expense',exact:true}).click();await expect(split.getByRole('checkbox',{name:'Mia Lee',exact:true})).not.toBeChecked();await split.getByRole('checkbox',{name:'Alex Tan',exact:true}).click();await split.getByRole('button',{name:'Change consumers',exact:true}).click();await page.keyboard.press('Escape');await expect(split).toHaveCount(0)
 await quick.getByRole('button',{name:'Split expense',exact:true}).click();await expect(split.getByRole('checkbox',{name:'Alex Tan',exact:true})).toBeChecked();await expect(split.getByRole('checkbox',{name:'Mia Lee',exact:true})).not.toBeChecked()
 for(const scale of[125,150,200]){await page.evaluate(s=>document.documentElement.style.fontSize=s+'%',scale);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);await expect(split.getByRole('button',{name:'Apply split',exact:true})).toBeVisible();await split.getByRole('button',{name:'Apply split',exact:true}).scrollIntoViewIfNeeded()}
 await page.setViewportSize({width,height:420});await split.getByRole('button',{name:'Apply split',exact:true}).scrollIntoViewIfNeeded();await expect(split.getByRole('button',{name:'Apply split',exact:true})).toBeInViewport();await shot(page,'large-text-'+width)
})
test('Members sends a real command, same request appears in Shared Review and explicit acceptance updates state',async({page})=>{
 const state=await setup(page);await page.goto('/space/'+id+'/members');await page.getByRole('button',{name:'Add Alex Tan as a friend',exact:true}).click();await expect(page.locator('[data-participant-id="alex"]')).toContainText('Sent');expect(state.writes).toHaveLength(1)
 await page.goto('/shared?view=review');const review=page.getByTestId('friend-request-review');await expect(review).toHaveCount(1);await expect(review).toContainText('Mia Lee');await expect(review).toContainText('Hanoi Trip');await shot(page,'friend-review');await review.getByRole('button',{name:'Accept',exact:true}).click();await expect(review).toHaveCount(0);expect(state.responses).toEqual(['accepted'])
 await page.goto('/space/'+id+'/members');await expect(page.locator('[data-participant-id="mia"]')).toContainText('Friend')
})
test('unknown send outcome re-reads pending state without a duplicate command',async({page})=>{
 const state=await setup(page);state.fail=true;await page.goto('/space/'+id+'/members');await page.getByRole('button',{name:'Add Alex Tan as a friend',exact:true}).click();await expect(page.locator('[data-participant-id="alex"]')).toContainText('Sent');expect(state.writes).toHaveLength(1);await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('[data-participant-id="alex"]')).toContainText('Sent');expect(state.writes).toHaveLength(1)
})

test('Trip Amounts and By item preserve payments and require recalculation after item changes',async({page})=>{
 await setup(page);await page.goto('/space/'+id+'/members');await page.getByRole('button',{name:'Quick add expense',exact:true}).click();const quick=page.getByRole('dialog',{name:'Quick Add',exact:true});await enterQuickAmount(quick,'10');await quick.getByRole('button',{name:'Split expense',exact:true}).click();const split=page.getByRole('dialog',{name:'Split expense',exact:true});await split.getByRole('button',{name:'Select all',exact:true}).click();await split.getByRole('button',{name:'Amounts',exact:true}).click()
 for(const[name,value]of[['You','4'],['Alex Tan','3'],['Mia Lee','3']])await split.getByRole('textbox',{name:'Share for '+name,exact:true}).fill(value)
 await split.getByRole('button',{name:'Apply split',exact:true}).click();await quick.getByRole('button',{name:'Split expense',exact:true}).click();await expect(split.getByRole('textbox',{name:'Share for Alex Tan',exact:true})).toHaveValue('3');await split.getByRole('button',{name:'By item',exact:true}).click();await split.getByRole('button',{name:'Add item',exact:true}).click();await split.getByRole('textbox',{name:'Item 1 amount',exact:true}).fill('10');await split.getByRole('button',{name:'Calculate shares',exact:true}).click();await shot(page,'by-item')
 await split.getByRole('textbox',{name:'Item 1 amount',exact:true}).fill('9');await split.getByRole('button',{name:'Apply split',exact:true}).click();await expect(split.getByRole('alert')).toContainText('Calculate item shares again');await split.getByRole('textbox',{name:'Item 1 amount',exact:true}).fill('10');await split.getByRole('button',{name:'Calculate shares',exact:true}).click();await split.getByRole('checkbox',{name:'You',exact:true}).click();await split.getByRole('button',{name:'Change consumers',exact:true}).click();await split.getByRole('button',{name:'Remove unselected item assignments',exact:true}).click();await split.getByRole('button',{name:'Calculate shares',exact:true}).click();await expect(split.locator('.qa-split-summary')).toContainText('RM 10.00');await split.getByRole('button',{name:'Apply split',exact:true}).click();await quick.getByRole('button',{name:'Split expense',exact:true}).click();await expect(split.getByRole('checkbox',{name:'You',exact:true})).not.toBeChecked();await expect(split.getByRole('textbox',{name:'Item 1 amount',exact:true})).toHaveValue('10');await expect(split.getByRole('button',{name:'By item',exact:true})).toHaveAttribute('aria-pressed','true')
})

test('Chinese long-name member actions remain readable at320px and200%text without displacing names',async({page})=>{
 const state=await setup(page,'zh');state.names.alex='Alex 很长的成员名字 '.repeat(8);state.tripName='很长的行程名称 '.repeat(6);await page.setViewportSize({width:320,height:844});await page.goto('/space/'+id+'/members');await expect(page.locator('.tm-row')).toHaveCount(3);await page.evaluate(()=>document.documentElement.style.fontSize='200%');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);const row=page.locator('[data-participant-id="alex"]');await expect(row).toContainText(state.names.alex);for(const button of await row.getByRole('button').all()){const box=await button.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44)}await row.locator('.tm-more').click();await page.keyboard.press('Escape');await expect(row.locator('.tm-more')).toBeFocused();await shot(page,'chinese-long-320-200')
})

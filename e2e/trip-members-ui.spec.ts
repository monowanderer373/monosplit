import {test,expect,type Page} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {setupMulticurrency} from './fixtures/multicurrency'
const id='00000000-0000-4000-8000-000000000101'
const path='/space/'+id+'/members'
/** Synthetic API contracts exercise production React/CSS; not real RLS evidence. */
async function setup(page:Page,{role='owner',lang='en'}={}){
 await setupMulticurrency(page,{lang})
 const row=(participant:string,name:string,access:string,kind='account')=>({space_id:id,participant_id:participant,role:access,joined_at:'2026-10-01T00:00:00Z',removed_at:null,participants:{id:participant,kind,display_name:name,auth_user_id:kind==='account'?participant:null,created_by:null}})
 const state={role,failActor:false,failRead:false,holdRead:false,releases:[]as Array<()=>void>,empty:false,access:true,delayRole:false,releaseRole:null as null|(()=>void),failWrite:false,lastInviteRole:'',writes:[]as string[],name:'Hanoi Trip',type:'trip',members:[row('owner','You',role),row('alex','Alex Tan','full_access'),row('mia','Mia Lee','view'),row('sam','Sam','view','manual')]}
 if(role!=='owner')state.members[1]=row('alex','Demo Owner','owner')
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Synthetic clipboard denied'))}}))
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const url=new URL(route.request().url()),p=url.pathname,body=route.request().method()==='POST'?route.request().postDataJSON():null
  if(p.endsWith('/auth/v1/user'))return route.fulfill({json:{id:'ui-contract-user',aud:'authenticated',role:'authenticated',is_anonymous:false,email:'fixture@example.test',user_metadata:{}}})
  if(p.endsWith('/rpc/current_participant_id'))return state.failActor?route.fulfill({status:503,json:{message:'Synthetic identity read failure'}}):route.fulfill({json:'owner'})
  if(p.endsWith('/space_members')){
   if(state.holdRead)await new Promise<void>(resolve=>state.releases.push(resolve))
   if(state.failRead)return route.fulfill({status:503,json:{message:'Synthetic network failure'}})
   const space={id,type:state.type,name:state.name,owner_participant_id:state.role==='owner'?'owner':'alex',status:'active',default_currency:'MYR',version:1,start_date:null,end_date:null,created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'}
   if(url.searchParams.get('select')?.includes('spaces('))return route.fulfill({json:state.access?[{role:state.role,spaces:space}]:[]})
   return route.fulfill({json:state.access&&!state.empty?state.members:[]})
  }
  if(p.endsWith('/rpc/update_space_member_role')){state.writes.push('role');if(state.delayRole)await new Promise<void>(resolve=>{state.releaseRole=resolve});if(state.failWrite)return route.fulfill({status:403,json:{message:'space_write_denied'}});state.members.find(r=>r.participant_id===body.target_participant_id)!.role=body.member_role;return route.fulfill({json:null})}
  if(p.endsWith('/rpc/remove_space_member')){state.writes.push('remove');if(body.target_participant_id==='owner')state.access=false;state.members=state.members.filter(r=>r.participant_id!==body.target_participant_id);return route.fulfill({json:null})}
  if(p.endsWith('/rpc/add_manual_space_member')){state.writes.push('add');const key='manual-'+state.writes.length;state.members.push(row(key,body.display_name,'view','manual'));return route.fulfill({json:key})}
  if(p.endsWith('/rpc/create_space_invite')){state.writes.push('invite');state.lastInviteRole=body.invite_role;return route.fulfill({json:'synthetic-ui-invite-only'})}
  return route.fallback()
 })
 return state
}
async function ready(page:Page){await page.goto(path);await expect(page.getByRole('list',{name:'Members',exact:true})).toBeVisible()}
async function capture(page:Page,name:string){await mkdir('test-results/trip-members',{recursive:true});await page.screenshot({path:'test-results/trip-members/'+name+'.png',animations:'disabled'})}
for(const width of[320,360,390,430])test(`Members paper list, menu and text scaling at ${width}px`,async({page})=>{
 const state=await setup(page);await page.setViewportSize({width,height:844});await ready(page)
 await expect(page.getByRole('navigation',{name:'Primary navigation'})).toHaveCount(1)
 await expect(page.locator('.tm-row')).toHaveCount(4);await expect(page.locator('.tm-row').first()).toContainText('You');await capture(page,'owner-'+width)
 await page.getByRole('button',{name:'Manage Alex Tan',exact:true}).click();await expect(page.getByRole('dialog',{name:'Manage Alex Tan'})).toBeVisible();if(width===390)await capture(page,'owner-menu')
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Manage Alex Tan'})).toBeFocused()
 state.name='A long trip name 旅行 '.repeat(5);state.members[1].participants.display_name='Alex '.repeat(30)
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.tm-heading')).toContainText(state.name)
 for(const scale of[125,150,200]){await page.evaluate(s=>document.documentElement.style.fontSize=s+'%',scale);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);for(const button of await page.locator('.tm-page button').all())expect(await button.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)}
 await capture(page,'long-200-'+width)
})
test('management preserves roles, confirms removal, handles rejected writes and truthful clipboard fallback',async({page})=>{
 const state=await setup(page);await ready(page)
 await page.getByRole('button',{name:'Invite',exact:true}).click();expect(state.writes).toEqual([]);await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(state.writes).toEqual([])
 await page.getByRole('button',{name:'Invite',exact:true}).click();await expect(page.getByRole('combobox')).toHaveValue('full_access');await page.getByRole('combobox').selectOption('view');await page.getByRole('button',{name:'Copy secure invite',exact:true}).click();await expect(page.getByText('Link created. Copy it manually below.')).toBeVisible();await expect(page.getByLabel('Invite link',{exact:true})).toBeVisible();expect(state.lastInviteRole).toBe('view');await page.getByRole('button',{name:'Cancel',exact:true}).click()
 state.delayRole=true;await page.getByRole('button',{name:'Manage Alex Tan'}).click();await page.getByRole('button',{name:'View only',exact:true}).click();await expect(page.locator('.tt-popover').getByText('Updating members…')).toBeVisible();await expect.poll(()=>!!state.releaseRole).toBe(true);state.releaseRole!();state.delayRole=false;await expect(page.locator('[data-participant-id="alex"]')).toContainText('View only');expect(state.writes.filter(w=>w==='role')).toHaveLength(1)
 state.failWrite=true;await page.getByRole('button',{name:'Manage Alex Tan'}).click();await page.getByRole('button',{name:'Full access',exact:true}).click();await expect(page.locator('.tm-error')).toBeVisible();await expect(page.locator('[data-participant-id="alex"]')).toContainText('View only');state.failWrite=false
 await page.getByRole('button',{name:'Add untracked member',exact:true}).click();await page.getByRole('textbox').fill('Sam');await page.getByRole('button',{name:'Add untracked member',exact:true}).click();await expect(page.locator('.tm-row')).toHaveCount(5)
 await page.locator('[data-participant-id="sam"]').getByRole('button').click();await expect(page.locator('.tt-popover').getByRole('button',{name:'Full access',exact:true})).toHaveCount(0);await expect(page.locator('.tt-popover').getByRole('button',{name:'View only',exact:true})).toHaveCount(0);await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Manage Alex Tan'}).click();await page.getByRole('button',{name:'Remove member',exact:true}).click();const before=state.writes.length;await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(state.writes.length).toBe(before)
 await page.getByRole('button',{name:'Manage Alex Tan'}).click();await page.getByRole('button',{name:'Remove member',exact:true}).click();await page.getByRole('button',{name:'Remove',exact:true}).click();await expect(page.locator('[data-participant-id="alex"]')).toHaveCount(0)
})
test('view-only has only own leave action, no fake friend controls and no writable global add',async({page})=>{
 const state=await setup(page,{role:'view'});await ready(page);await expect(page.getByRole('button',{name:'Invite',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Add untracked member',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Manage You'})).toBeVisible();await expect(page.getByRole('button',{name:'Manage Demo Owner'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Quick add expense',exact:true})).toBeDisabled();await capture(page,'view-only')
 await page.getByRole('button',{name:'Manage You'}).click();await page.getByRole('button',{name:'Leave',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(state.writes).toEqual([])
 await page.getByRole('button',{name:'Manage You'}).click();await page.getByRole('button',{name:'Leave',exact:true}).click();await page.getByRole('button',{name:'Leave',exact:true}).click();await expect(page).toHaveURL(/\/shared\?tab=trips$/)
})
test('read errors and anomalous empty membership do not become zero; revoked access clears cached controls',async({page})=>{
 const state=await setup(page);state.failRead=true;await page.goto(path);await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();await expect(page.locator('.tm-heading')).not.toContainText('0 members')
 state.failRead=false;state.failActor=true;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();await expect(page.getByText('This trip is unavailable',{exact:true})).toHaveCount(0);state.failActor=false;state.empty=true;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByText('The member list needs verification. Please retry.')).toBeVisible()
 state.empty=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('.tm-row')).toHaveCount(4)
 state.access=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByText('This trip is unavailable',{exact:true})).toBeVisible();await expect(page.locator('.tm-row')).toHaveCount(0);await expect(page.getByRole('button',{name:'Invite',exact:true})).toHaveCount(0);await page.goBack();await expect(page).toHaveURL(/\/shared\?tab=trips$/)
})
test('direct refresh and old Trip links use one safe same-trip Back entry; Group remains on its old page',async({page})=>{
 const state=await setup(page);await ready(page);await page.reload();await expect(page.locator('.tm-row')).toHaveCount(4);await page.goBack();await expect(page).toHaveURL(new RegExp('/travel/trip/'+id+'$'))
 await page.goto('/space/'+id+'?section=members');await expect(page.getByRole('list',{name:'Members',exact:true})).toBeVisible();await page.getByRole('button',{name:'Trip',exact:true}).click();await expect(page).toHaveURL(new RegExp('/travel/trip/'+id+'$'))
 state.type='group';await page.goto(path);await expect(page).toHaveURL(new RegExp('/space/'+id+'$'));await expect(page.locator('#trip-members')).toBeVisible();await expect(page.getByRole('button',{name:'Add untracked person',exact:true})).toBeVisible()
})
test('Trip ledger keeps expense context but not duplicate members; global plus resolves this Trip and preserves return scroll',async({page})=>{
 await setup(page);await page.goto('/space/'+id+'?section=info');await expect(page.getByTestId('trip-ledger-members')).toBeVisible();await expect(page.locator('#trip-members')).toHaveCount(0);await expect(page.getByRole('button',{name:'Copy secure invite',exact:true})).toHaveCount(0)
 await page.evaluate(()=>window.scrollTo(0,100));const scroll=await page.evaluate(()=>window.scrollY);await page.getByTestId('trip-ledger-members').click();await expect(page.getByRole('list',{name:'Members',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Quick add expense',exact:true}).click();const quick=page.getByRole('dialog',{name:'Quick Add',exact:true});await expect(quick.getByTestId('quick-add-ledger')).toContainText('Hanoi Trip');await quick.getByRole('button',{name:'Close Quick Add',exact:true}).click()
 await page.getByRole('button',{name:'Trip',exact:true}).click();await expect(page).toHaveURL(new RegExp('/space/'+id+'\\?section=info$'));await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeCloseTo(scroll,0)
})
test('Chinese narrow layout uses real labels and has no horizontal overflow',async({page})=>{
 await setup(page,{lang:'zh'});await page.setViewportSize({width:320,height:740});await page.goto(path);await expect(page.getByRole('list',{name:'成员',exact:true})).toBeVisible();await expect(page.locator('.tm-row').first()).toContainText('我');await expect(page.locator('.tm-row').first()).toContainText('创建者');await expect(page.locator('[data-participant-id="alex"]')).toContainText('可编辑');await expect(page.locator('[data-participant-id="mia"]')).toContainText('仅查看');await page.evaluate(()=>document.documentElement.style.fontSize='200%');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);await capture(page,'chinese-320-200')
})

test('all overview Members entries share one destination without nested buttons',async({page})=>{
 await setup(page);await page.goto('/travel/trip/'+id);await expect(page.getByRole('heading',{name:'Hanoi Trip',exact:true})).toBeVisible();await expect(page.locator('.tt-members-entry button')).toHaveCount(0)
 await page.getByTestId('trip-ledger-members').click();await expect(page.getByRole('list',{name:'Members',exact:true})).toBeVisible();await page.goBack();await expect(page.getByTestId('trip-ledger-members')).toBeVisible()
 await page.getByTestId('trip-ledger-members').click();await expect(page).toHaveURL(new RegExp('/space/'+id+'/members$'));await page.goBack();await page.getByRole('button',{name:/actions/i}).click();await page.locator('.tt-popover').getByRole('button',{name:'Members',exact:true}).click();await expect(page).toHaveURL(new RegExp('/space/'+id+'/members$'))
})

test('personal affiliations and invalid Members IDs cannot become shared contexts and return safely',async({page})=>{
 await setup(page)
 for(const target of['affiliation:private-label','not-a-space']){await page.goto('/space/'+encodeURIComponent(target)+'/members');await expect(page.getByText('This trip is unavailable',{exact:true})).toBeVisible();await expect(page.locator('.tm-row')).toHaveCount(0);await expect(page.getByRole('button',{name:'Quick add expense',exact:true})).toBeDisabled();await page.goBack();await expect(page).toHaveURL(/\/shared\?tab=trips$/)}
})

test('trailing-slash direct Members keeps global plus locked during authority loading, then targets this Trip',async({page})=>{
 const state=await setup(page);state.holdRead=true;await page.goto(path+'/');await expect(page.getByRole('button',{name:'Quick add expense',exact:true})).toBeDisabled();await expect.poll(()=>state.releases.length).toBeGreaterThanOrEqual(2);state.holdRead=false;state.releases.forEach(resolve=>resolve());await expect(page.getByRole('list',{name:'Members',exact:true})).toBeVisible();await page.getByRole('button',{name:'Quick add expense',exact:true}).click();await expect(page.getByTestId('quick-add-ledger')).toContainText('Hanoi Trip')
})

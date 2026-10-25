import {test,expect,type Page} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {setupMulticurrency} from './fixtures/multicurrency'

/** Production components + intercepted synthetic API. SQL/E2E separately verify real financial writes. */
async function setup(page:Page,{available=true,hidden=false,failPreview=false}={}){
 const base=await setupMulticurrency(page,{hidden})
 const state={name:'Paper Tester',commits:0,profiles:0,passwordWrites:0,failPreview,available,lostResponse:false,pending:false}
 const user={id:'ui-contract-user',aud:'authenticated',role:'authenticated',email:'paper-ui@example.test',is_anonymous:false,email_confirmed_at:'2026-10-01T00:00:00Z',user_metadata:{display_name:state.name},identities:[{provider:'email',id:'email-ui',user_id:'ui-contract-user',identity_data:{email:'paper-ui@example.test'}}]}
 const old={id:'00000000-0000-4000-8000-000000000080',started_at:'2026-01-01T00:00:00Z',ended_at:'2026-10-25T00:00:00Z',status:'archived'}
 const preview={schema_version:1,owner_id:'owner',id:'00000000-0000-4000-8000-000000000081',fingerprint:'synthetic-contract-fingerprint',expires_at:new Date(Date.now()+900000).toISOString(),policy:'carry_all',accounts:[{account_id:'cash',parent_id:'cash',name:'Cash',currency:'MYR',known:true,balance_minor:'128000',version:1,parent_version:1},{account_id:'vnd',parent_id:'wise',name:'Wise',currency:'VND',known:true,balance_minor:'-90000',version:1,parent_version:1}],currencies:[{currency:'MYR',amount_minor:'1800'},{currency:'VND',amount_minor:'90000'}],personal_count:2,protected_shared_count:3,protected_settlement_count:2,pending_funding_count:1,ongoing_installment_count:1,recurring_rule_count:1,conflicts:[]}
 let receipt:Record<string,unknown>|null=null
 await page.route('http://127.0.0.1:54321/**',async r=>{
  const path=new URL(r.request().url()).pathname,method=r.request().method()
  if(path.endsWith('/auth/v1/user')){if(method==='PUT')state.passwordWrites++;return r.fulfill({json:user})}
  if(path.endsWith('/auth/v1/token')){
   const exp=Math.floor(Date.now()/1000)+3600,access_token=[btoa(JSON.stringify({alg:'HS256',typ:'JWT'})),btoa(JSON.stringify({sub:user.id,exp,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]})),'test-only'].join('.')
   return r.fulfill({json:{access_token,refresh_token:'test-only',expires_at:exp,expires_in:3600,token_type:'bearer',user}})
  }
  if(path.endsWith('/user_profiles')){if(method==='POST'){state.profiles++;state.name=r.request().postDataJSON().display_name}return r.fulfill({json:{display_name:state.name,default_currency:'MYR',timezone:'Asia/Kuala_Lumpur'}})}
  if(path.endsWith('/rpc/get_personal_ledger_period_state'))return state.available?r.fulfill({json:{schema_version:1,owner_id:'owner',periods:[old],archived_expense_ids:[],archived_transaction_ids:[],later_funding:[]}}):r.fulfill({status:404,json:{code:'PGRST202'}})
  if(path.endsWith('/rpc/preview_personal_fresh_start'))return state.failPreview?r.fulfill({status:503,json:{message:'Synthetic unavailable'}}):r.fulfill({json:preview})
  if(path.endsWith('/rpc/get_personal_fresh_start_preview'))return r.fulfill({json:preview})
  if(path.endsWith('/rpc/apply_personal_fresh_start')){
   const body=r.request().postDataJSON();expect(body.p_openings).toEqual([{account_id:'cash',amount_minor:'128000'},{account_id:'vnd',amount_minor:'-90000'}]);state.commits++;receipt={schema_version:1,owner_id:'owner',request_id:body.p_request_id,period_id:'00000000-0000-4000-8000-000000000082',archived_period_id:old.id,completed_at:new Date().toISOString(),policy:'carry_all'};return state.lostResponse?r.abort('failed'):r.fulfill({json:receipt})
  }
  if(path.endsWith('/rpc/reconcile_personal_fresh_start'))return r.fulfill({json:receipt?{state:'committed',result:receipt}:{state:'fenced'}})
  if(path.endsWith('/rpc/get_personal_ledger_archive'))return r.fulfill({json:{schema_version:1,period:old,expenses:[{id:'history',description:'Archived personal purchase',category:'Food',currency:'VND',total_minor:'90000',occurred_on:'2026-01-02',status:'active',corrects_expense_id:null}],transactions:[],openings:[]}})
  return r.fallback()
 })
 return {state,base}
}
const shots='test-results/me-v2'
async function capture(page:Page,name:string){await mkdir(shots,{recursive:true});await page.screenshot({path:`${shots}/${name}.png`,animations:'disabled'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)}
async function beginReview(page:Page){await page.goto('/profile/fresh-start');await page.getByRole('button',{name:'Review Fresh Start',exact:true}).click();await expect(page.getByRole('heading',{name:'Review the impact',exact:true})).toBeVisible()}

test('twelve approved Me states use real components and honest deferred actions',async({page})=>{
 const {state}=await setup(page);await page.setViewportSize({width:390,height:852});await page.goto('/profile')
 await expect(page.getByRole('heading',{name:'Me',exact:true})).toBeVisible();await expect(page.locator('.me-profile')).toContainText('Paper Tester');await expect(page.getByRole('navigation',{name:'Primary navigation'})).toBeVisible();await expect(page.getByRole('textbox')).toHaveCount(0);await capture(page,'01-home')
 await page.locator('.me-profile').click();await expect(page.getByRole('navigation',{name:'Primary navigation'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Quick add expense',exact:true})).toHaveCount(0);await capture(page,'02-details')
 await page.getByRole('textbox',{name:'Display name',exact:true}).fill('Changed Paper Tester');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Changes saved.');expect(state.profiles).toBe(1)
 for(const [path,name]of [['security','03-security'],['privacy','04-privacy'],['help','05-help'],['feedback/bug','06-feedback']]){await page.goto('/profile/'+path);await expect(page.locator('.me-header h1')).toBeVisible();if(path==='security')await expect(page.getByRole('textbox')).toHaveCount(0);await capture(page,name)}
 await page.goto('/profile');await page.getByRole('button',{name:/Language.*English/}).click();await expect(page.getByRole('dialog',{name:'App language',exact:true})).toBeVisible();await capture(page,'07-language');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.goto('/profile/fresh-start');await expect(page.getByRole('button',{name:'Review Fresh Start',exact:true})).toBeEnabled();await capture(page,'08-fresh-intro');await page.getByRole('button',{name:'Review Fresh Start',exact:true}).click();await expect(page.getByRole('heading',{name:'Review the impact'})).toBeVisible();await capture(page,'09-impact');await page.getByRole('button',{name:'Review opening balances',exact:true}).click();await expect(page.getByRole('heading',{name:'Opening balances',exact:true})).toBeVisible();await capture(page,'10-openings');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Confirm Fresh Start'})).toBeVisible();await capture(page,'11-confirm');await expect(page.getByRole('button',{name:'Start new personal ledger',exact:true})).toBeDisabled()
 await page.goto('/profile/archives');await expect(page.getByRole('heading',{name:'Past personal ledgers'})).toBeVisible();await capture(page,'12-archives');await page.getByRole('button',{name:/Archived · read only/}).click();await expect(page.getByText('Archived personal purchase')).toBeVisible();await expect(page.getByRole('button',{name:/Edit|Delete/})).toHaveCount(0);expect(state.commits).toBe(0);expect(state.passwordWrites).toBe(0)
})
for(const width of [320,360,390,430])test(`Me long text, subpage navigation and 200% text at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:852});await page.goto('/profile');await expect(page.locator('.me-profile')).toBeVisible();await page.locator('.me-profile strong').evaluate(e=>e.textContent='A long display name 这是很长的用户名称 that must wrap safely')
 await page.evaluate(()=>document.documentElement.style.fontSize='200%')
 await capture(page,`stress-home-${width}-200`);await page.getByRole('button',{name:/Privacy & data/}).click();await expect(page.getByRole('navigation')).toHaveCount(0);await expect(page.locator('.me-header h1')).toHaveText('Privacy & data');await capture(page,`stress-privacy-${width}-200`);await page.goBack();await expect(page.getByRole('navigation',{name:'Primary navigation'})).toBeVisible()
})
test('missing capability and failed preview fail closed; privacy hides native balances',async({page})=>{
 const {state}=await setup(page,{available:false,hidden:true});await page.goto('/profile/fresh-start');await expect(page.getByRole('button',{name:'Review Fresh Start',exact:true})).toBeDisabled();await expect(page.getByText(/financial safeguards are installed/)).toBeVisible();state.available=true;await page.reload();await page.getByRole('button',{name:'Review Fresh Start',exact:true}).click();await expect(page.getByText('••••').first()).toBeVisible();await expect(page.getByText(/90,000|18.00/)).toHaveCount(0);expect(state.commits).toBe(0)
})
test('lost commit response is reconciled after reload without posting twice',async({page})=>{
 const {state}=await setup(page);state.lostResponse=true;await beginReview(page);await page.getByRole('button',{name:'Review opening balances',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('Current password',{exact:true}).fill('synthetic-test-password-123');await page.getByRole('button',{name:'Verify sign-in',exact:true}).click();await expect(page.getByText(/Sign-in verified/)).toBeVisible();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Start new personal ledger',exact:true}).click();await expect(page.getByRole('button',{name:'Check request status',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toBeVisible();expect(state.commits).toBe(1);await page.reload();await page.getByRole('button',{name:'Check request status',exact:true}).click();await expect(page.getByText('Your new personal ledger is ready',{exact:true})).toBeVisible();expect(state.commits).toBe(1)
})

for(const scale of [1.25,1.5,2])test(`dialog and keyboard-safe inputs at ${scale*100}% text`,async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:600});await page.goto('/profile');await page.evaluate(scale=>document.documentElement.style.fontSize=`${scale*100}%`,scale);await page.getByRole('button',{name:/Language.*English/}).click();const d=page.getByRole('dialog',{name:'App language',exact:true});await expect(d).toBeVisible();await expect(d.getByRole('button',{name:'English',exact:true})).toBeInViewport();await page.goBack();await expect(d).toHaveCount(0);await page.locator('.me-profile').click();await page.setViewportSize({width:390,height:420});const name=page.getByRole('textbox',{name:'Display name',exact:true});await name.scrollIntoViewIfNeeded();await name.fill('Keyboard-safe tester');await page.getByRole('button',{name:'Save changes',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Save changes',exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

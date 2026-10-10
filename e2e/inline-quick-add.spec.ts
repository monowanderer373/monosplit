import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'
import { createConfirmedAccount, openAuthenticatedBrowser } from './fixtures/localSupabase'
import { enterQuickAmount } from './fixtures/quickAdd'
const anon='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
async function rpc(client:SupabaseClient,name:string,args:Record<string,unknown>={}){const {data,error}=await client.rpc(name,args);if(error)throw new Error(`${name}: ${error.message}`);return data}
async function capture(page:Page,name:string){
 await mkdir('test-results/inline-quick-add',{recursive:true})
 await page.screenshot({path:`test-results/inline-quick-add/${name}.png`,fullPage:true,animations:'disabled'})
 const geometry=await page.locator('.qa-main').evaluate(root=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,elements:[...root.querySelectorAll('.qa-context-button,.qa-picker,.qa-options-scroll,.qa-type-tab,.qa-option,.qa-inputs,.qa-keypad,.qa-save-buttons')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {class:el.className,x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontSize,background:s.backgroundColor,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}})}))
 await writeFile(`test-results/inline-quick-add/${name}.json`,JSON.stringify(geometry,null,2))
 expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+1)
 for(const tab of geometry.elements.filter(el=>el.class==='qa-type-tab'))expect(tab.height).toBeGreaterThanOrEqual(44)
}
for(const width of [320,360,390,430])test(`Inline ledger selection and real friend scope at ${width}px`,async({browser},info)=>{
 test.setTimeout(180_000)
 const account=await createConfirmedAccount('inline-picker','Picker Tester',`${Date.now()}-${info.parallelIndex}-${width}`)
 const client=createClient('http://127.0.0.1:54321',anon,{auth:{persistSession:false,autoRefreshToken:false}})
 const {error}=await client.auth.signInWithPassword({email:account.email,password:account.password});if(error)throw error
 const self=await rpc(client,'current_participant_id')
 const trips:string[]=[]
 for(const name of ['Mountain weekend','Coastal journey','City break','Forest expedition','A very long journey name that remains readable on a small screen','Lake escape'])trips.push(await rpc(client,'create_space',{space_type:'trip',space_name:name,start_date:'2026-10-01',end_date:'2026-10-15',default_currency:'VND'}))
 const group=await rpc(client,'create_space',{space_type:'group',space_name:'Household',start_date:null,end_date:null,default_currency:'SGD'})
 await rpc(client,'add_manual_space_member',{target_space_id:group,display_name:'Roommate'})
 const people:string[]=[]
 for(const display_name of ['Ada','Ben','Cora'])people.push(await rpc(client,'create_manual_person',{display_name}))
 const wallet=await rpc(client,'create_personal_account',{request_id:randomUUID(),account_name:'Travel wallet',account_type:'cash',currency_code:'MYR',opening_balance_minor:null,balance_as_of:null,make_default:true})
 const actor=await openAuthenticatedBrowser(browser,account),page=actor.page
 await page.setViewportSize({width,height:844})
 try{
  await page.getByTestId('home-mode-switch').getByRole('button',{name:'Daily',exact:true}).click()
  await page.getByRole('button',{name:'Quick add expense',exact:true}).click()
  const quick=page.getByRole('dialog',{name:'Quick Add',exact:true}),header=quick.getByTestId('quick-add-ledger')
  await expect(header).toContainText('Personal ledger')
  await expect(quick.getByRole('heading',{name:'Quick Add'})).toHaveClass('qa-sr-only')
  await quick.getByRole('button',{name:'Coffee',exact:true}).click();await enterQuickAmount(quick,'12+8')
  await quick.getByRole('textbox',{name:'Description'}).fill('Tea and snacks')
  await expect(quick.getByRole('button',{name:/Travel wallet/})).toBeVisible()
  await capture(page,`01-ready-${width}`)
  const baseline=await quick.locator('.qa-inputs').boundingBox()
  await header.click();await quick.getByRole('tab',{name:'Trips',exact:true}).click()
  await expect(quick.locator('.qa-option--single')).toHaveCount(4)
  await expect(page.getByRole('dialog')).toHaveCount(1);await expect(header).toContainText('Personal ledger')
  await expect(quick.getByRole('button',{name:'Save and close'})).toBeDisabled();await expect(quick.getByRole('button',{name:'Save and continue'})).toBeDisabled()
  await expect(quick.getByRole('searchbox')).not.toBeFocused()
  const expanded=await quick.locator('.qa-inputs').boundingBox();expect(Math.abs(expanded!.y-baseline!.y)).toBeLessThan(2)
  await capture(page,`02-trips-${width}`)
  await quick.getByRole('button',{name:'More trips ↓',exact:true}).click();await expect(quick.getByRole('button',{name:/Mountain weekend/})).toHaveCount(1)
  await capture(page,`more-results-${width}`)
  await quick.getByRole('searchbox').fill('Mountain weekend');await quick.getByRole('button',{name:/Mountain weekend/}).click()
  await expect(header).toContainText('Mountain weekend');await expect(header).toHaveAttribute('aria-expanded','false')
  await expect(quick.getByLabel('Currency',{exact:true})).toHaveValue('MYR');await expect(quick.getByRole('textbox',{name:'Amount'})).toHaveValue('12+8')
  await expect(quick.getByRole('button',{name:'Coffee',exact:true})).toHaveAttribute('aria-pressed','true')
  await header.click();await quick.getByRole('tab',{name:'Groups',exact:true}).click();await expect(quick.getByRole('button',{name:/Household/})).toBeVisible()
  await expect(header).toContainText('Mountain weekend');await capture(page,`03-groups-${width}`)
  await page.keyboard.press('Escape');await expect(header).toBeFocused();await expect(header).toHaveAttribute('aria-expanded','false')
  await header.click();await quick.getByRole('tab',{name:'Friends',exact:true}).click()
  for(const name of ['Ada','Ben','Cora'])await quick.getByRole('checkbox',{name,exact:true}).check()
  await expect(quick.getByText('3 selected',{exact:true})).toBeVisible();await expect(header).toContainText('Mountain weekend')
  await expect(quick.getByRole('button',{name:/^Split/})).toContainText('Personal');await capture(page,`04-friends-${width}`)
  await quick.getByRole('searchbox').fill('Ada');await expect(quick.getByText('3 selected',{exact:true})).toBeVisible()
  await quick.getByRole('button',{name:'Use selected friends',exact:true}).click()
  const split=page.getByRole('dialog',{name:'Split expense',exact:true})
  await expect(split).toBeVisible();for(const name of ['Ada','Ben','Cora'])await expect(split.getByRole('checkbox',{name,exact:true})).toBeChecked()
  await split.getByRole('button',{name:'Amounts',exact:true}).click();await split.getByRole('textbox',{name:'Share for Picker Tester'}).fill('5')
  await split.getByRole('button',{name:'Apply split',exact:true}).click();await expect(split).toHaveCount(0)
  await expect(header).toContainText('FRIENDS');await expect(header).toContainText('+2')
  await header.click();await quick.getByRole('tab',{name:'Groups',exact:true}).click();await quick.getByRole('button',{name:/Household/}).click()
  await expect(quick.getByText(/replace this 4-person split/)).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(1);await capture(page,`impact-${width}`)
  await quick.getByRole('button',{name:'Keep current',exact:true}).click();await expect(header).toContainText('FRIENDS')
  await quick.getByRole('button',{name:/^Split/}).click();await expect(split.getByRole('button',{name:'Amounts',exact:true})).toHaveAttribute('aria-pressed','true');await expect(split.getByRole('textbox',{name:'Share for Picker Tester'})).toHaveValue('5')
  await split.getByRole('button',{name:'Apply split',exact:true}).click()
  await expect(quick.getByRole('textbox',{name:'Description'})).toHaveValue('Tea and snacks');await expect(quick.getByLabel('Currency',{exact:true})).toHaveValue('MYR')
  await quick.getByRole('button',{name:'Save and close',exact:true}).click();await expect(quick).toHaveCount(0)
  const {data:saved,error:savedError}=await client.from('expenses').select('id,scope,space_id,currency,total_minor').eq('description','Tea and snacks');if(savedError)throw savedError
  expect(saved).toHaveLength(1);expect(saved![0]).toMatchObject({scope:'direct',space_id:null,currency:'MYR',total_minor:2000})
  const {data:funding,error:fundingError}=await client.from('personal_funding_intents').select('account_id,expense_currency,account_currency').eq('expense_id',saved![0].id);if(fundingError)throw fundingError
  expect(funding).toHaveLength(1);expect(funding![0]).toMatchObject({account_id:wallet.account_id,expense_currency:'MYR',account_currency:'MYR'})
  const {data:participants}=await client.from('expense_participations').select('participant_id').eq('expense_id',saved![0].id);expect(participants).toHaveLength(4);expect(participants?.some(row=>row.participant_id===self)).toBe(true)
  const {data:tripMembers}=await client.from('space_members').select('participant_id').eq('space_id',trips[0]);expect(tripMembers?.map(row=>row.participant_id)).toEqual([self])
  // Page context still restores the original Trip draft, independently of the direct save.
  await page.goto(`/travel/trip/${trips[0]}`);await page.getByRole('button',{name:'Quick add expense',exact:true}).click();await expect(header).toContainText('Mountain weekend');await expect(quick.getByRole('textbox',{name:'Amount'})).toHaveValue('12+8')
  await header.click();await quick.getByRole('tab',{name:'Trips',exact:true}).click();await quick.getByRole('button',{name:'More trips ↓',exact:true}).click();await capture(page,`long-names-${width}`)
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%'})
  await capture(page,`text-200-percent-${width}`)
  const fit=await quick.locator('.qa-tab-face').evaluateAll(faces=>faces.every(face=>face.scrollWidth<=face.clientWidth+1));expect(fit).toBe(true)
  await quick.getByRole('tab',{name:'Friends',exact:true}).click();await expect(quick.getByRole('checkbox',{name:'Ada',exact:true})).toBeVisible();await capture(page,`text-200-friends-${width}`)
  const listHeight=await quick.locator('.qa-options-scroll').evaluate(el=>el.clientHeight);expect(listHeight).toBeGreaterThan(100)
  await quick.getByRole('button',{name:'Save and close',exact:true}).scrollIntoViewIfNeeded();const saveBox=await quick.getByRole('button',{name:'Save and close',exact:true}).boundingBox();expect(saveBox!.y+saveBox!.height).toBeLessThanOrEqual(844);await capture(page,`text-200-save-${width}`)
  await page.evaluate(()=>{document.documentElement.style.fontSize=''})
  await quick.getByRole('button',{name:'Close Quick Add',exact:true}).click();await expect(quick).toHaveCount(0)
  await page.goto(`/person/${people[1]}`);await expect(page.getByRole('heading',{name:'Ben',exact:true})).toBeVisible();await page.getByRole('button',{name:'Quick add expense',exact:true}).click()
  await expect(header).toContainText('Ben');await quick.getByRole('button',{name:/^Split/}).click();await expect(split.getByRole('checkbox',{name:'Ben',exact:true})).toBeChecked();await expect(split.getByRole('checkbox',{name:'Ada',exact:true})).not.toBeChecked()
  await split.getByRole('button',{name:'Close panel',exact:true}).click();await quick.getByRole('button',{name:'Close Quick Add',exact:true}).click();await expect(quick).toHaveCount(0)
 }finally{await actor.context.close()}
})

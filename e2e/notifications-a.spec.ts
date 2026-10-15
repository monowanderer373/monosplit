import {expect,test} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {notificationScenario} from './fixtures/notificationScenarios'
import {noticeExpense} from '../src/test/notificationFixtures'
const out='test-results/notifications-a'
test.beforeAll(async()=>{await mkdir(out,{recursive:true})})
for(const scene of ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','L1','L2','L3','S1','S2','S3','S4','S5','S6','S7'])test(`approved ${scene} uses the real exact-object application surface without navigation writes`,async({page})=>{
 const {state,path,releaseRead}=await notificationScenario(page,scene);await page.goto(path)
 const root=scene==='A8'||scene==='A9'?page.getByTestId('collect-pay-page'):page.getByTestId('notification-target');await expect(root).toBeVisible();if(scene!=='S5'){await expect(root).not.toHaveAttribute('aria-busy','true');await expect(root.locator('[aria-busy="true"]')).toHaveCount(0)}
 if(['A1','A2','A3','A4','A10','S1','S2','S3','S4','S5','S6','S7'].includes(scene)){
  await expect(root).toHaveAttribute('role','dialog');await expect(root.locator('.home-sheet-handle')).toHaveCount(0)
  const geometry=await root.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,width:innerWidth,height:visualViewport?.height??innerHeight}});expect(Math.abs(geometry.x+geometry.w/2-geometry.width/2)).toBeLessThanOrEqual(2);expect(Math.abs(geometry.y+geometry.h/2-geometry.height/2)).toBeLessThanOrEqual(2)
 }
 else{await expect(root).not.toHaveAttribute('role','dialog');await expect(page.getByTestId('notification-target-backdrop')).toHaveCount(0)}
 if(scene==='A2'){await expect(root.getByRole('textbox')).toHaveValue('');await expect(root.getByRole('button',{name:'Update balance'})).toBeDisabled();await expect(root).toContainText('Use the amount shown by your wallet')}
 if(scene==='A3'||scene==='A4')await expect(root.getByRole('button',{name:'Record as paid'})).toBeVisible()
 if(scene==='A5'){await expect(root).toContainText('Your share');await expect(root).toContainText('24.00');await expect(root).toContainText('72.00');await expect(root.getByRole('button',{name:'Accept share'})).toBeVisible()}
 if(scene==='A6'){await expect(root).toContainText('24.00');await expect(root).toContainText('30.00');await expect(root).toContainText('Original record stays active');await expect(root.getByRole('button',{name:'Accept change'})).toBeVisible()}
 if(scene==='A7'){await expect(root).toContainText('Removed if cancellation is approved');await expect(root.getByRole('button',{name:'Approve cancellation'})).toBeVisible()}
 if(scene==='A8'){await expect(root.locator('[data-notice-entity="payment:payment"]')).toBeFocused();await expect(root.getByRole('button',{name:'Confirm received'})).toBeVisible();await expect(root).toContainText('Confirm only after the money arrives')}
 if(scene==='A9'){await expect(root.locator('[data-notice-entity="request:request"]')).toBeFocused();await expect(root).toContainText('Pay outside Tabby Tally');await expect(root.getByRole('textbox',{name:/Amount/})).toHaveValue('30.00')}
 if(scene==='A10'){await expect(root.getByRole('button',{name:'Retry save'})).toBeVisible();await expect(root.getByRole('button',{name:/Undo|Discard/})).toHaveCount(0)}
 if(scene==='S6')await expect(root.getByRole('button',{name:'Sign in'})).toBeVisible()
 if(scene==='A11')await expect(root.locator('.notification-a-entry')).toHaveCount(1)
 expect(state.writes).toHaveLength(0);await root.screenshot({path:`${out}/${scene}.png`});const geometry=await root.evaluate(el=>({scene:el.tagName,width:innerWidth,pageWidth:document.documentElement.scrollWidth}));expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.width+1);await writeFile(`${out}/${scene}.json`,JSON.stringify(geometry));releaseRead()
})
for(const [scene,action]of [['A3','Record as paid'],['A4','Record as paid'],['A5','Accept share'],['A6','Accept change'],['A7','Approve cancellation']])test(`${scene} explicit original action updates current source without repeating it`,async({page})=>{
 const {state,path}=await notificationScenario(page,scene);await page.goto(path);const target=page.getByTestId('notification-target');const button=target.getByRole('button',{name:action,exact:true});await expect(button).toBeVisible();expect(state.writes).toHaveLength(0);await button.dblclick();await expect(button).toHaveCount(0);await expect(target).toContainText('already been handled');expect(state.writes).toHaveLength(1)
})
for(const scene of ['A2','A6'])for(const width of [320,360,390,430])for(const font of [125,150,200])test(`${scene} task fits ${width}px with ${font}% root text`,async({page})=>{
 await page.setViewportSize({width,height:844});const {path,state}=await notificationScenario(page,scene);await page.goto(path);const root=page.getByTestId('notification-target');await expect(root).toBeVisible();await expect(root).not.toHaveAttribute('aria-busy','true');await expect(root.locator('[aria-busy="true"]')).toHaveCount(0);await page.evaluate(font=>document.documentElement.style.fontSize=font+'%',font)
 const action=root.getByRole('button',{name:scene==='A2'?'Update balance':'Accept change',exact:true});await action.scrollIntoViewIfNeeded();await expect(action).toBeVisible();const geometry=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));expect(geometry.scroll).toBeLessThanOrEqual(geometry.w+1);expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);expect(state.writes).toHaveLength(0);await root.screenshot({path:`${out}/${scene}-${width}-${font}.png`})
})
test('no-account recovery opens existing Accounts and returns to the original typed task',async({page})=>{
 const {path,state}=await notificationScenario(page,'S7');await page.goto(path);await page.getByTestId('notification-target').getByRole('button',{name:'View accounts'}).click();await expect(page.getByTestId('notification-target')).toHaveCount(0);await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByTestId('notification-target').getByRole('heading',{name:'No account available'})).toBeVisible();expect(state.writes).toHaveLength(0)
})
test('uncertain outbox reconciles an already saved original request without a second write or Undo',async({page})=>{
 const {path,state}=await notificationScenario(page,'A10');await page.goto(path);const root=page.getByTestId('notification-target');await expect(root.getByRole('button',{name:'Retry save'})).toBeVisible();const expense=noticeExpense('server-taxi','Taxi');expense.clientRequestId='outbox-original';state.snapshot.expenses=[expense];await root.getByRole('button',{name:'Retry save'}).click();await expect(root).toContainText('already been handled');expect(state.writes).toHaveLength(0);await expect(root.getByRole('button',{name:/Retry save|Undo|Discard/})).toHaveCount(0)
})
test('desktop page retains exact target and reachable controls',async({page})=>{
 await page.setViewportSize({width:1280,height:900});const {path,state}=await notificationScenario(page,'A6');await page.goto(path);const root=page.getByTestId('notification-target');await expect(root.getByRole('button',{name:'Accept change'})).toBeVisible();expect(state.writes).toHaveLength(0);await root.screenshot({path:`${out}/A6-desktop.png`})
})
test('large account amounts and long entry text remain complete at 320px and 200% root text',async({page})=>{
 await page.setViewportSize({width:320,height:844});const {path}=await notificationScenario(page,'A11');await page.route('http://127.0.0.1:54321/rest/v1/personal_account_entries*',async route=>route.fulfill({json:[{id:'huge-entry',account_id:'wallet-1',amount_minor:9007199254740990,currency:'MYR',transaction:{kind:'income',occurred_on:'2026-10-15',memo:'A very long account transaction description that must remain readable'}}]}));await page.goto(path);const root=page.getByTestId('notification-target');await expect(root.locator('.notification-a-account-balance')).toContainText('90,071,992,547,409.90');await page.evaluate(()=>document.documentElement.style.fontSize='200%');await expect(root.locator('.notification-a-entry')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);await root.screenshot({path:`${out}/A11-large-320-200.png`})
})

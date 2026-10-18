import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { setupMulticurrency } from './fixtures/multicurrency'
import { enterQuickAmount } from './fixtures/quickAdd'
const out='test-results/quick-add-compact'
test.beforeAll(async()=>{await mkdir(out,{recursive:true})})
async function open(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'Quick add expense',exact:true}).click()
 const quick=page.getByRole('dialog',{name:'Quick Add',exact:true})
 await quick.getByRole('button',{name:'Food',exact:true}).click();await enterQuickAmount(quick,'9105')
 await expect(quick.getByRole('button',{name:'Save and close',exact:true})).toBeEnabled()
 return quick
}
for(const width of [320,360,390,430])for(const height of [640,740,844])test(`capture has no page scroll at ${width}x${height}`,async({page})=>{
 const state=await setupMulticurrency(page);await page.setViewportSize({width,height});const quick=await open(page)
 const geometry=await quick.evaluate(root=>{
  const content=root.querySelector('.qa-content')!,save=root.querySelector('.qa-save-buttons')!,amount=root.querySelector('.qa-inputs')!,categories=root.querySelector('.qa-category-or-picker-slot')!
  return {height:innerHeight,scrollHeight:content.scrollHeight,clientHeight:content.clientHeight,scrollTop:content.scrollTop,saveBottom:save.getBoundingClientRect().bottom,amountTop:amount.getBoundingClientRect().top,categoriesTop:categories.getBoundingClientRect().top,keys:[...root.querySelectorAll('.qa-keypad button')].map(el=>({height:el.getBoundingClientRect().height,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom}))}
 })
 expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight+1);expect(geometry.scrollTop).toBe(0);expect(geometry.saveBottom).toBeLessThanOrEqual(height);expect(geometry.categoriesTop).toBeGreaterThanOrEqual(0)
 for(const key of geometry.keys){expect(key.height).toBeGreaterThanOrEqual(44);expect(key.top).toBeGreaterThanOrEqual(0);expect(key.bottom).toBeLessThanOrEqual(height)}
 await expect(quick.getByText('Paid from',{exact:true})).toHaveCount(0);await expect(quick.getByText('I know the deduction',{exact:true})).toHaveCount(0);await expect(quick.getByText('Verify deduction later',{exact:true})).toHaveCount(0)
 expect(state.writes).toHaveLength(0);await page.screenshot({path:`${out}/capture-${width}-${height}.png`});await writeFile(`${out}/capture-${width}-${height}.json`,JSON.stringify(geometry,null,2))
})
for(const width of [320,360,390,430])for(const font of [125,150,200])test(`capture and optional funding stay reachable at ${width}px / ${font}% text`,async({page})=>{
 const state=await setupMulticurrency(page);await page.setViewportSize({width,height:844});const quick=await open(page);await page.evaluate(font=>document.documentElement.style.fontSize=font+'%',font)
 await quick.getByRole('button',{name:'Save and close',exact:true}).scrollIntoViewIfNeeded();await expect(quick.getByRole('button',{name:'Save and close',exact:true})).toBeInViewport()
 await quick.locator('.qa-actions>button').nth(1).click();const account=page.getByRole('dialog',{name:'Payment account',exact:true});await account.getByRole('button',{name:'Actual charge (optional)'}).click();await account.getByRole('combobox',{name:'Payment source',exact:true}).selectOption('bank');await account.getByRole('textbox').fill('9105');await account.getByRole('checkbox').check();await account.getByRole('button',{name:'Use Wise',exact:true}).scrollIntoViewIfNeeded();await expect(account.getByRole('button',{name:'Use Wise',exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);expect(state.writes).toHaveLength(0)
 await account.screenshot({path:`${out}/funding-${width}-${font}.png`})
})
test('one account entry retains actual native drafts, cancels changes and does not write until Save',async({page})=>{
 const state=await setupMulticurrency(page);const quick=await open(page)
 const openAccount=()=>quick.locator('.qa-actions>button').nth(1).click(),account=page.getByRole('dialog',{name:'Payment account',exact:true})
 await openAccount();await account.getByRole('button',{name:'Actual charge (optional)'}).click();await account.getByRole('combobox',{name:'Payment source',exact:true}).selectOption('bank');await account.getByRole('textbox').fill('9105');await account.getByRole('checkbox').check();await account.getByRole('button',{name:'Use Wise',exact:true}).click();await expect(account).toHaveCount(0)
 await openAccount();await expect(account.getByRole('textbox')).toHaveValue('9,105');await expect(account.getByRole('checkbox')).toBeChecked();await account.getByRole('textbox').fill('9106');await page.keyboard.press('Escape');await expect(account).toHaveCount(0);await expect(quick.locator('.qa-actions>button').nth(1)).toBeFocused()
 await openAccount();await expect(account.getByRole('textbox')).toHaveValue('9,105');await expect(account.getByRole('checkbox')).toBeChecked();await account.getByRole('button',{name:'Actual charge (optional)'}).click();await account.getByRole('button',{name:'Use Wise',exact:true}).click();await expect(quick.getByRole('button',{name:'Save and close',exact:true})).toBeEnabled();expect(state.writes).toHaveLength(0)
})
test('every category and original editing remain available, selection survives full list return',async({page})=>{
 await setupMulticurrency(page);const quick=await open(page);await quick.getByRole('button',{name:'All categories',exact:true}).click();const all=page.getByRole('dialog',{name:'All categories',exact:true});await expect(all.getByRole('button',{name:'Game',exact:true})).toHaveCount(1);await all.getByRole('button',{name:'Game',exact:true}).click();await expect(all).toHaveCount(0);await expect(quick.getByRole('button',{name:'Game',exact:true})).toHaveAttribute('aria-pressed','true');await expect(quick.getByRole('textbox',{name:'Description',exact:true})).toHaveValue('Game')
 await quick.getByRole('button',{name:'All categories',exact:true}).click();await all.getByRole('button',{name:'Edit categories',exact:true}).click();await expect(page.getByRole('dialog',{name:'Edit categories',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(quick.getByRole('textbox',{name:'Amount',exact:true})).toHaveValue('9,105')
})
test('foreign expense remains deferred without an invented conversion and invalid actual input blocks Done',async({page})=>{
 const state=await setupMulticurrency(page);const quick=await open(page);await quick.getByRole('combobox',{name:'Currency',exact:true}).selectOption('VND');await enterQuickAmount(quick,'90000');await expect(quick.getByRole('button',{name:'Save and close',exact:true})).toBeEnabled();await quick.locator('.qa-actions>button').nth(1).click();const account=page.getByRole('dialog',{name:'Payment account',exact:true});await expect(account.getByRole('textbox')).toHaveCount(0);await expect(account).toContainText('No balance is deducted yet');await account.getByRole('button',{name:'Actual charge (optional)'}).click();await account.getByRole('combobox',{name:'Payment source',exact:true}).selectOption('bank');await expect(account.getByRole('textbox')).toHaveValue('');await expect(account.getByRole('button',{name:'Use Wise',exact:true})).toBeDisabled();await account.getByRole('textbox').fill('16.20');await expect(account.getByRole('button',{name:'Use Wise',exact:true})).toBeDisabled();await account.getByRole('checkbox').check();await expect(account.getByRole('button',{name:'Use Wise',exact:true})).toBeEnabled();expect(state.writes).toHaveLength(0)
})
test('current To do verification is centered, compact and has a readable amount with a gated submit',async({page})=>{
 const state=await setupMulticurrency(page)
 await page.setViewportSize({width:390,height:844});await page.goto('/accounts/verify?account=bank')
 await page.getByRole('button',{name:/Train ticket/}).click()
 const dialog=page.getByTestId('verify-deduction')
 await dialog.getByRole('combobox',{name:'Payment source',exact:true}).selectOption('bank')
 // Bounding boxes include the entry scale animation. Measure its completed state.
 await dialog.evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})))})
 const box=(await dialog.boundingBox())!
 expect(box.height).toBeLessThan(600)
 expect(Math.abs(box.x+box.width/2-195)).toBeLessThan(2)
 expect(Math.abs(box.y+box.height/2-422)).toBeLessThan(2)
 await expect(dialog.getByRole('button',{name:'Confirm & next'})).toBeDisabled()
 const source=dialog.getByRole('combobox',{name:'Payment source',exact:true})
 expect((await source.boundingBox())!.width).toBeGreaterThan(box.width*.75)
 const check=dialog.getByRole('checkbox');expect((await check.boundingBox())!.width).toBeGreaterThanOrEqual(20)
 await dialog.getByRole('textbox').fill('6000');await check.check()
 await expect(dialog.getByRole('button',{name:'Confirm & next'})).toBeEnabled()
 await dialog.screenshot({path:`${out}/todo-390.png`});expect(state.writes).toHaveLength(0)
})

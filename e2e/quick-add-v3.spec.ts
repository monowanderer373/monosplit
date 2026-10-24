import {test,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {setupMulticurrency} from './fixtures/multicurrency'
const out='test-results/quick-add-v3'
const people=['Alex','Blair','Casey'].map((display_name,i)=>({id:`00000000-0000-4000-8000-00000000000${i+1}`,owner_participant_id:'owner',display_name,linked_participant_id:null,merged_into_person_id:null}))
async function setup(page:import('@playwright/test').Page,count=3){
 const contacts=Array.from({length:count},(_,i)=>({...people[i%3],id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,display_name:i<3?people[i].display_name:`Friend ${i+1}`}))
 const state=await setupMulticurrency(page)
 await page.route('http://127.0.0.1:54321/rest/v1/person_relationships*',r=>r.fulfill({json:contacts}))
 await page.route('http://127.0.0.1:54321/rest/v1/person_manual_participants*',r=>r.fulfill({json:contacts.map((p,i)=>({person_id:p.id,manual_participant_id:`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,is_primary:true}))}))
 await page.setViewportSize({width:393,height:852});await page.goto('/');await page.getByRole('button',{name:'Quick add expense',exact:true}).click()
 const quick=page.getByRole('dialog',{name:'Quick Add',exact:true});for(const digit of ['1','8','.','9'])await quick.getByRole('button',{name:digit,exact:true}).click()
 return{state,quick}
}
test('V3 eight live component states and draft-only split',async({page})=>{
 await mkdir(out,{recursive:true});const {state,quick}=await setup(page)
 await expect(quick.getByRole('textbox',{name:'Note'})).toHaveValue('');await expect(quick.locator('.qa-category-or-picker-slot .qa-category')).toHaveCount(8)
 // A suggestion is optional when no mature suggestion exists; do not fabricate one for screenshots.
 await page.screenshot({animations:'disabled',path:out+'/01_quick_add_suggested.png'});await quick.getByRole('button',{name:'Save and close',exact:true}).click();await expect(quick.getByRole('alert')).toContainText('Choose a category');expect(state.writes).toHaveLength(0)
 await quick.getByRole('button',{name:'Food',exact:true}).click();await expect(quick.getByRole('textbox',{name:'Note'})).toHaveValue('')
 await page.screenshot({animations:'disabled',path:out+'/02_quick_add_category_confirmed.png'})
 await quick.locator('.qa-account-trigger').click();const account=page.getByRole('dialog',{name:'Payment account',exact:true});await page.screenshot({animations:'disabled',path:out+'/04_account_selector.png'})
 await account.getByRole('button',{name:/No account/}).click();await expect(account).toHaveCount(0);await expect(quick.getByRole('textbox',{name:'Amount'})).toHaveValue('18.9');await expect(quick.locator('.qa-account-trigger')).toContainText('No account');await quick.locator('.qa-account-trigger').click();await account.getByRole('button',{name:/^Wise/}).click();await expect(account).toHaveCount(0);await expect(quick.getByRole('textbox',{name:'Note'})).toHaveValue('')
 await quick.getByRole('button',{name:'Split expense',exact:true}).click();const split=page.getByRole('dialog',{name:'Split expense',exact:true});await expect(split.getByLabel('Search people')).toBeVisible()
 await split.getByRole('checkbox',{name:'Alex'}).check();await split.getByRole('checkbox',{name:'Blair'}).check();const avatar=await split.locator('.qa-person-choice .qa-avatar').first().boundingBox();expect(avatar!.width).toBe(30);expect(avatar!.height).toBe(30);await expect(split.getByRole('checkbox',{name:'Alex'})).toHaveAttribute('type','checkbox');await page.screenshot({animations:'disabled',path:out+'/05_split_people_selector.png'})
 await split.getByRole('button',{name:'Continue →',exact:true}).click();await expect(split.getByText('3 people', {exact:true})).toBeVisible()
 await expect(split.locator('.qa-split-person[data-selected=true]')).toHaveCount(3)
 await page.screenshot({animations:'disabled',path:out+'/06_split_equally.png'})
 await split.getByRole('button',{name:'Amounts',exact:true}).click();await expect(split.getByRole('button',{name:'Amounts',exact:true})).toHaveAttribute('aria-pressed','true');await split.locator('.qa-split-person[data-selected=true] input:not([type=checkbox])').first().fill('6.30');await split.getByRole('textbox',{name:'Share for Alex',exact:true}).fill('6.30');await expect(split.getByRole('textbox',{name:'Share for Blair',exact:true})).toHaveValue('6.30');await split.getByRole('textbox',{name:'Share for Alex',exact:true}).blur();await page.screenshot({animations:'disabled',path:out+'/07_split_amounts.png'})
 await split.getByRole('button',{name:'By item',exact:true}).click();await expect(split.getByRole('button',{name:'By item',exact:true})).toHaveAttribute('aria-pressed','true');await page.screenshot({animations:'disabled',path:out+'/08_split_by_item.png'})
 await split.getByRole('button',{name:'Equally',exact:true}).click();await split.getByRole('button',{name:'Apply split',exact:true}).click();await expect(split).toHaveCount(0)
 await expect(quick.locator('.qa-split-trigger')).toContainText('Shared · 3');expect(state.writes).toHaveLength(0);await page.screenshot({animations:'disabled',path:out+'/03_quick_add_shared.png'})
})

for(const [width,height] of [[360,800],[390,844],[393,852],[412,915],[393,700]])test(`V3 controls reachable at ${width}x${height}`,async({page})=>{
 const {quick}=await setup(page);await page.setViewportSize({width,height});await quick.getByRole('button',{name:'Food',exact:true}).click()
 const save=quick.getByRole('button',{name:'Save and close',exact:true});await save.scrollIntoViewIfNeeded();await expect(save).toBeInViewport()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1)
 for(const button of await quick.locator('.qa-keypad>button').all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48)
 await quick.getByRole('textbox',{name:'Note'}).focus();await expect(quick.getByRole('button',{name:'Save and close',exact:true})).toBeVisible();await page.setViewportSize({width,height:420});await expect(quick.locator('.qa-keypad')).toBeHidden();await expect(quick.locator('.qa-category-grid')).toBeVisible();await quick.getByRole('textbox',{name:'Note'}).fill('Bus');await quick.getByRole('textbox',{name:'Note'}).blur();await page.setViewportSize({width,height});await expect(quick.locator('.qa-keypad')).toBeVisible()
})

test('twenty contacts and many items retain a fixed accessible Apply footer',async({page})=>{
 const {quick,state}=await setup(page,20);await page.setViewportSize({width:393,height:700});await quick.getByRole('button',{name:'Food',exact:true}).click();await quick.getByRole('button',{name:'Split expense',exact:true}).click();const split=page.getByRole('dialog',{name:'Split expense',exact:true});for(const name of ['Alex','Blair','Casey','Friend 4','Friend 5'])await split.getByRole('checkbox',{name,exact:true}).check();await split.getByRole('button',{name:'Continue →',exact:true}).click();await expect(split.getByText('6 people',{exact:true})).toBeVisible();await split.getByRole('button',{name:'By item',exact:true}).click();for(let i=0;i<8;i++)await split.getByRole('button',{name:'Add item',exact:true}).click();const apply=split.getByRole('button',{name:'Apply split',exact:true});const before=await apply.boundingBox();await split.locator('.qa-split-body').evaluate(el=>el.scrollTop=el.scrollHeight);await expect(apply).toBeInViewport();const after=await apply.boundingBox();expect(Math.abs(before!.y-after!.y)).toBeLessThan(1);expect(state.writes).toHaveLength(0);await page.screenshot({animations:'disabled',path:out+'/stress-items-393-700.png'})
})

for(const width of [320,360,390,430])test(`ledger picker preserves the measured receipt position at ${width}px`,async({page})=>{
 const {quick}=await setup(page);await page.setViewportSize({width,height:844});const receipt=quick.locator('.qa-receipt');const before=(await receipt.boundingBox())!.y;const header=quick.getByTestId('quick-add-ledger');await header.click();await expect(header).toHaveAttribute('aria-expanded','true');expect(Math.abs((await receipt.boundingBox())!.y-before)).toBeLessThan(2);await expect(quick.getByRole('button',{name:'Save and close',exact:true})).toBeDisabled();await expect(quick.getByRole('button',{name:'Save options',exact:true})).toBeDisabled();await header.click();await expect(quick.getByRole('textbox',{name:'Amount',exact:true})).toHaveValue('18.9')
})

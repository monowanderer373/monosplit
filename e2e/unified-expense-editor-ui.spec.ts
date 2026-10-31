import {test,expect,type Page} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {setupTripLedger,tripLedgerId} from './fixtures/tripLedger'
import {tripLedgerExpense} from '../src/test/tripLedgerFixtures'
import {apiExpense} from './fixtures/insightsUi'
import type {CanonicalExpense} from '../src/types'

// Actual React/production CSS, intercepted synthetic transport only. Real RLS
// and transactional witnesses live in trip_expense_editor.sql / backend E2E.
async function fixture(page:Page,kind:'private'|'shared'='shared',hidden=false){
 const state=await setupTripLedger(page,{hidden});state.payments=[]
 const expense:CanonicalExpense=kind==='private'?{...tripLedgerExpense('00000000-0000-4000-8000-000000000471','Private meal',[['owner',10000,10000]]),scope:'personal',spaceId:null}:tripLedgerExpense('00000000-0000-4000-8000-000000000472','Trip dinner',[['owner',0,0],['mia',100000,100000]])
 state.expenses=[expense]
 let canEdit=true,fail=false,commitThenFail=false,committed=false,privateDenied=false
 const people=['owner','mia'].map(id=>({id,name:id==='owner'?'You':'Mia',kind:'account',role:id==='owner'?'owner':'full_access'}))
 let settings:unknown=null
 const commands:Record<string,unknown>[]=[]
 await page.route('**/rest/v1/personal_expense_affiliations?**',route=>route.fulfill({json:kind==='private'?[{id:'affiliation',owner_participant_id:'owner',expense_id:expense.id,trip_id:tripLedgerId,label:'Hanoi Trip',archived_at:null,version:1,created_at:expense.createdAt,updated_at:expense.updatedAt}]:[]}))
 await page.route('**/rest/v1/rpc/get_trip_expense_editor',route=>{const row=apiExpense(expense);return route.fulfill({json:{schema_version:1,audience:kind,trip_id:tripLedgerId,trip_name:'Hanoi Trip',trip_status:'active',role:canEdit?'owner':'view',can_edit:canEdit,expense:row,members:people,settings,funding:[],accounts:[{id:'account',name:'Touch n Go',currency:'MYR'}],participations:row.participations,contributions:row.payer_contributions,shares:row.expense_shares}})})
 await page.route('**/rest/v1/rpc/save_trip_expense_editor',async route=>{const body=route.request().postDataJSON();commands.push(body);if(privateDenied&&body.desired_audience==='private')return route.fulfill({status:409,json:{code:'P0001',message:'audience_transition_has_dependencies'}});if(fail)return route.fulfill({status:409,json:{code:'P0001',message:'version_conflict'}});committed=true;if(commitThenFail)return route.abort('failed');return route.fulfill({json:{expense_id:expense.id,expense_version:2,audience:body.desired_audience,trip_id:tripLedgerId}})})
 await page.route('**/rest/v1/rpc/reconcile_personal_money_operation',route=>route.fulfill({json:committed?{state:'committed',result:{expense_id:expense.id,expense_version:2}}:{state:'not_posted'}}))
 await page.goto('/travel/trip/'+tripLedgerId)
 await expect(page.getByTestId('space-recent')).toContainText(expense.description!)
 return {state,expense,commands,people,markCommitted:()=>{committed=true},denyPrivate:()=>{privateDenied=true},setItems:()=>{settings={consumer_ids:['mia'],split_mode:'items',items:[{id:'item',name:'Meal',amount:'1000',participantIds:['mia']}]};},setReadOnly:()=>{canEdit=false},fail:()=>{fail=true},uncertain:()=>{commitThenFail=true}}
}
async function open(page:Page,name:string){await page.getByRole('button',{name:'Edit '+name,exact:true}).click();const editor=page.getByTestId('unified-expense-editor');await expect(editor.getByRole('textbox',{name:'Amount',exact:true})).toBeVisible();return editor}
async function shot(page:Page,name:string){await mkdir('test-results/issue07',{recursive:true});await page.screenshot({path:'test-results/issue07/'+name+'.png',animations:'disabled'})}

for(const width of[320,360,390,430])test('shared same-page editor '+width,async({page})=>{
 await page.setViewportSize({width,height:864});const f=await fixture(page),editor=await open(page,'Trip dinner')
 await expect(editor.getByRole('checkbox',{name:'You',exact:true})).not.toBeChecked();await expect(editor.getByRole('checkbox',{name:'Mia',exact:true})).toBeChecked();await expect(editor.getByRole('checkbox',{name:'Mia',exact:true})).toHaveCSS('background-color','rgb(52, 107, 141)');await expect(editor.getByRole('checkbox',{name:'You',exact:true})).toHaveCSS('border-top-style','solid')
 await expect(editor.getByRole('button',{name:'Paid by',exact:true})).toHaveCount(0)
 await expect(editor.getByRole('button',{name:'Apply split',exact:true})).toHaveCount(0);await expect(editor.getByText('History for this expense')).toHaveCount(0)
 await expect(editor.getByRole('button',{name:'Save changes'})).toBeDisabled();await expect(page.locator('.tt-nav')).not.toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1)
 if(width===390){const geometry=await editor.locator('.ue-body').evaluate(el=>({h:el.clientHeight,scroll:el.scrollHeight}));expect(geometry.scroll).toBeLessThanOrEqual(geometry.h+1);await shot(page,'shared-390')}
 for(const scale of[125,150,200]){await page.evaluate(s=>document.documentElement.style.fontSize=s+'%',scale);expect(await editor.evaluate(el=>el.scrollWidth)).toBeLessThanOrEqual(width+1);await expect(editor.getByRole('button',{name:'Save changes'})).toBeInViewport();await expect(editor.getByRole('button',{name:'Cancel expense',exact:true})).toBeInViewport()}
 await shot(page,'shared-'+width+'-200');expect(f.commands).toHaveLength(0)
})
test('private inline expansion keeps one draft and posts only the final Save',async({page})=>{
 const f=await fixture(page,'private'),editor=await open(page,'Private meal');await expect(editor).toContainText('Only you');await expect(editor.getByLabel('Payment account')).toBeVisible();await shot(page,'private-390')
 await editor.getByRole('button',{name:'Split with trip members'}).click();await editor.getByRole('checkbox',{name:'Mia',exact:true}).check();await expect(editor).toContainText('Saving will share this expense with trip members.');expect(f.commands).toHaveLength(0)
 await editor.getByRole('button',{name:'Equally',exact:true}).click();await editor.getByRole('button',{name:'Save changes'}).click();await expect(editor).toHaveCount(0);expect(f.commands).toHaveLength(1);expect(f.commands[0]).toMatchObject({desired_audience:'shared',expense_payload:{total_minor:10000,contribution_amounts:[10000,0],share_amounts:[5000,5000]}})
})
test('amount mismatch, dirty close and Back keep the same payer/consumer draft',async({page})=>{

 const f=await fixture(page),editor=await open(page,'Trip dinner');await editor.getByLabel('Amount',{exact:true}).fill('2000');await expect(editor.getByRole('button',{name:'Save changes'})).toBeDisabled();await expect(editor.getByLabel('Share for Mia')).toHaveValue('1,000.00');await page.evaluate(()=>window.history.back());await expect(editor).toBeVisible();await expect(editor.getByRole('heading',{name:'Discard unsaved changes?'})).toBeVisible();await editor.getByRole('button',{name:'Keep editing'}).click();await expect(editor.getByLabel('Amount',{exact:true})).toHaveValue('2000');await expect(editor.locator('.ue-formatted')).toHaveText('2,000.00');await page.keyboard.press('Escape');await editor.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(editor).toHaveCount(0);expect(f.commands).toHaveLength(0)
})
test('version rejection retains fields and loads latest only after explicit discard',async({page})=>{
 const f=await fixture(page);f.fail();const editor=await open(page,'Trip dinner');await editor.getByLabel('Note',{exact:true}).fill('Uncommitted note');await editor.getByRole('button',{name:'Save changes'}).click();await expect(editor.getByLabel('Note',{exact:true})).toHaveValue('Uncommitted note');await editor.getByRole('button',{name:'Reload latest record'}).click();await expect(editor.getByLabel('Note',{exact:true})).toHaveValue('Uncommitted note');await editor.getByRole('button',{name:'Discard and reload'}).click();await expect(editor.getByLabel('Note',{exact:true})).toHaveValue('Trip dinner');expect(f.commands).toHaveLength(1)
})
test('lost response reconciles the original request without a second Save or stored money',async({page})=>{
 const f=await fixture(page);f.uncertain();const editor=await open(page,'Trip dinner');await editor.getByLabel('Note',{exact:true}).fill('Not in storage');await editor.getByRole('button',{name:'Save changes'}).click();await expect(editor.getByRole('button',{name:'Check save status'})).toBeEnabled();await expect(editor.getByLabel('Note',{exact:true})).toBeDisabled();const values=await page.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('tt.trip-editor-command:')).map(([,v])=>JSON.parse(v)));expect(values).toHaveLength(1);expect(Object.keys(values[0]).sort()).toEqual(['fingerprint','requestId']);await editor.getByRole('button',{name:'Check save status'}).click();await expect(editor).toHaveCount(0);expect(f.commands).toHaveLength(1)
})
test('readonly is fullscreen without writable controls or global +',async({page})=>{
 const f=await fixture(page);f.setReadOnly();await page.getByRole('button',{name:'Edit Trip dinner',exact:true}).click();const editor=page.getByTestId('unified-expense-editor');await expect(editor.getByRole('heading',{name:'Record details'})).toBeVisible();await expect(editor.getByRole('button',{name:'Save changes'})).toHaveCount(0);await expect(editor.getByRole('textbox')).toHaveCount(0);await expect(page.locator('.tt-nav')).not.toBeVisible();await page.keyboard.press('Escape');await expect(editor).toHaveCount(0);expect(f.commands).toHaveLength(0)
})

test('large original currency, long names, large text and short keyboard viewport remain usable',async({page})=>{
 const f=await fixture(page);f.expense.currency='VND';f.expense.totalMinor=9007199254740991;for(const p of f.expense.payerContributions)if(p.amountMinor)p.amountMinor=f.expense.totalMinor;for(const s of f.expense.shares)if(s.amountMinor)s.amountMinor=f.expense.totalMinor;f.people[1].name='长期旅行成员 Very long participant name';await page.setViewportSize({width:320,height:864});const editor=await open(page,'Trip dinner');await expect(editor.locator('.ue-formatted')).toHaveText('9,007,199,254,740,991');await editor.getByLabel('Amount',{exact:true}).focus();await expect(editor.getByLabel('Amount',{exact:true})).toHaveValue('9007199254740991');await page.evaluate(()=>document.documentElement.style.fontSize='200%');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);await page.setViewportSize({width:320,height:420});await expect(editor.getByRole('button',{name:'Save changes'})).toBeInViewport();await expect(editor.getByRole('button',{name:'Cancel expense',exact:true})).toBeInViewport();expect(f.commands).toHaveLength(0)
})
test('readonly item fields are disabled and focus cannot enter the underlay',async({page})=>{
 const f=await fixture(page);f.setReadOnly();f.setItems();await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Edit Trip dinner',exact:true}).click();const editor=page.getByTestId('unified-expense-editor');await expect(editor.getByRole('button',{name:'Calculate shares'})).toBeDisabled();await expect(editor.getByLabel('Item 1 amount')).toBeDisabled();await expect(editor).toHaveCSS('animation-name','none');const close=editor.getByRole('button',{name:'Close expense editor'});await close.focus();await page.keyboard.press('Tab');await expect(close).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(close).toBeFocused();expect(f.commands).toHaveLength(0)
})
test('amount privacy gates editor money in visible and accessible content',async({page})=>{
 await fixture(page,'shared',true);await page.getByRole('button',{name:'Open record',exact:true}).click();const editor=page.getByTestId('unified-expense-editor');await expect(editor.getByRole('button',{name:'Show amount to continue'})).toBeVisible();expect(await editor.innerText()).not.toContain('1,000');expect(await editor.locator('[aria-label]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')).join(' '))).not.toContain('1,000');await expect(editor.locator('input')).toHaveCount(0);await page.keyboard.press('Escape')
})

test('No account and Verify later keep different explicit draft semantics',async({page})=>{
 const f=await fixture(page,'private'),editor=await open(page,'Private meal');const select=editor.getByLabel('Payment account');await select.selectOption('account');await select.selectOption('');expect(f.commands).toHaveLength(0);await editor.getByRole('button',{name:'Save changes'}).click();await expect(editor).toHaveCount(0);expect(f.commands).toHaveLength(1);expect(f.commands[0]).toMatchObject({account_choice:{account_id:null,defer:false}})
})

test('failed private conversion keeps Shared visibility and can return to Shared editing',async({page})=>{
 const f=await fixture(page);f.denyPrivate();const editor=await open(page,'Trip dinner');await editor.getByRole('button',{name:'Mia',exact:true}).click();await editor.getByLabel('Paid by You',{exact:true}).fill('1000');await editor.getByLabel('Paid by Mia',{exact:true}).fill('0');await editor.getByRole('checkbox',{name:'You',exact:true}).check();await editor.getByRole('checkbox',{name:'Mia',exact:true}).uncheck();await editor.getByRole('button',{name:'Equally',exact:true}).click();await editor.getByRole('button',{name:'Make private after review'}).click();await editor.getByRole('button',{name:'Confirm private',exact:true}).click();await expect(editor.locator('.ue-visibility')).toHaveText('Shared');await expect(editor).not.toContainText('Only you');await editor.getByRole('button',{name:'Save changes'}).click();await expect(editor).toContainText('Keep it shared to continue editing.');await editor.getByRole('button',{name:'Keep shared',exact:true}).click();await editor.getByRole('button',{name:'Save changes'}).click();await expect(editor).toHaveCount(0);expect(f.commands.map(command=>command.desired_audience)).toEqual(['private','shared'])
})

test('an interrupted save remains reconcilable after its source becomes readonly',async({page})=>{
 const f=await fixture(page);f.markCommitted();f.setReadOnly();f.expense.status='voided';await page.evaluate(id=>sessionStorage.setItem('tt.trip-editor-command:owner:'+id,JSON.stringify({requestId:crypto.randomUUID(),fingerprint:'0'.repeat(64)})),f.expense.id);await page.getByRole('button',{name:'Edit Trip dinner',exact:true}).click();const editor=page.getByTestId('unified-expense-editor');await expect(editor.getByRole('button',{name:'Check save status'})).toBeEnabled();await expect(editor.getByRole('button',{name:'Cancel expense',exact:true})).toHaveCount(0);await editor.getByRole('button',{name:'Check save status'}).click();await expect(editor).toHaveCount(0);expect(f.commands).toHaveLength(0)
})

test('browser reload restores the opaque command even when the corrected source has left the active list',async({page})=>{
 const f=await fixture(page);f.uncertain();let editor=await open(page,'Trip dinner');await editor.getByLabel('Note',{exact:true}).fill('Interrupted browser save');await editor.getByRole('button',{name:'Save changes'}).click();await expect(editor.getByRole('button',{name:'Check save status'})).toBeEnabled();f.expense.status='voided';f.setReadOnly();page.once('dialog',dialog=>void dialog.accept());await page.reload();editor=page.getByTestId('unified-expense-editor');await expect(editor.getByRole('button',{name:'Check save status'})).toBeEnabled();await expect(editor.getByRole('button',{name:'Cancel expense',exact:true})).toHaveCount(0);await editor.getByRole('button',{name:'Check save status'}).click();await expect(editor).toHaveCount(0);expect(f.commands).toHaveLength(1)
})
test('reload without an in-flight command clears only the orphan editor marker',async({page})=>{
 await fixture(page);await open(page,'Trip dinner');await page.reload();await expect(page.getByTestId('space-recent')).toContainText('Trip dinner');await expect(page.getByTestId('unified-expense-editor')).toHaveCount(0);expect(await page.evaluate(()=>history.state?.usr?.routeOverlay)).toBeUndefined();await open(page,'Trip dinner');await page.keyboard.press('Escape');await expect(page.getByTestId('unified-expense-editor')).toHaveCount(0)
})

test('visible list counts own private and Shared rows while Shared summary counts only Shared',async({page})=>{
 const f=await fixture(page,'private');f.state.expenses.push(tripLedgerExpense('00000000-0000-4000-8000-000000000473','Shared bill',[['owner',0,0],['mia',100000,100000]]));await page.reload();await expect(page.locator('.tl-list-toolbar')).toHaveText('2 expenses');await expect(page.getByTestId('space-recent').locator('[data-expense-id]')).toHaveCount(2);await expect(page.getByTestId('trip-detail-summary')).toContainText('1 shared record');await expect(page.getByTestId('travel-spending')).toHaveText('RM 100.00')
})

import {test,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {setupNotifications} from './fixtures/notifications'
for(const width of[320,360,390,430])test(`original-bill retag review is compact, private and draft-free at ${width}px`,async({page})=>{
 const state=await setupNotifications(page);state.snapshot.funding=[];state.snapshot.accounts.forEach(a=>a.entrySumMinor=100)
 const e=state.snapshot.expenses[0];e.scope='direct';e.description='Original dinner bill';e.totalMinor=20000;e.participantCount=2
 e.participations.push({id:'friend-part',expenseId:e.id,participantId:'friend',nameSnapshot:'Friend',order:1,state:'accepted',trackingMode:'tracked'})
 e.shares[0].amountMinor=10000;e.shares.push({expenseId:e.id,expenseParticipationId:'friend-part',amountMinor:10000});e.payerContributions[0].amountMinor=20000
 e.sharedRestart={ownerIds:['owner'],hiddenForViewer:true,edges:[{id:'edge-1',debtorId:'owner',creditorId:'friend',recipientId:'owner',remainingMinor:6000,effectiveMinor:0}],retags:[{id:'retag-1',edgeId:'edge-1',requesterId:'friend',recipientId:'owner',state:'pending',expenseVersion:e.version,createdAt:'2026-10-26T00:00:00Z'}]}
 const writes:Record<string,unknown>[]=[]
 await page.route('http://127.0.0.1:54321/rest/v1/rpc/respond_shared_split_retag',async route=>{const body=route.request().postDataJSON();writes.push(body);e.sharedRestart!.retags[0].state=body.response;if(body.response==='accepted'){e.sharedRestart!.hiddenForViewer=false;e.sharedRestart!.edges[0].effectiveMinor=6000}return route.fulfill({json:body.response})})
 await page.setViewportSize({width,height:740});await page.goto('/?notice=retag&target=retag-1')
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Accept split',exact:true})).toBeVisible();await expect(dialog).toContainText('RM 60.00');await expect(dialog).toContainText('Only the unpaid amount')
 await mkdir('test-results/shared-reset',{recursive:true});await page.screenshot({path:`test-results/shared-reset/retag-${width}.png`,fullPage:true})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
 for(const scale of[125,150,200]){await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);const accept=dialog.getByRole('button',{name:'Accept split',exact:true});await accept.scrollIntoViewIfNeeded();await expect(accept).toBeInViewport();expect((await accept.boundingBox())!.height).toBeGreaterThanOrEqual(44);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)}
 await page.evaluate(()=>document.documentElement.style.fontSize='100%');await dialog.getByRole('button',{name:'Accept split',exact:true}).dblclick();await expect.poll(()=>writes.length).toBe(1);expect(writes[0]).toEqual({target_request_id:'retag-1',response:'accepted',expected_expense_version:1});await expect(page.getByRole('button',{name:'Accept split',exact:true})).toHaveCount(0)
})
test('hidden retag never exposes money or permits acceptance before reveal',async({page})=>{
 const state=await setupNotifications(page,{hidden:true});state.snapshot.funding=[]
 const e=state.snapshot.expenses[0];e.sharedRestart={ownerIds:['owner'],hiddenForViewer:true,edges:[{id:'edge-1',debtorId:'friend',creditorId:'owner',recipientId:'owner',remainingMinor:6000,effectiveMinor:0}],retags:[{id:'retag-1',edgeId:'edge-1',requesterId:'friend',recipientId:'owner',state:'pending',expenseVersion:e.version,createdAt:'2026-10-26'}]}
 await page.goto('/?notice=retag&target=retag-1');const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog).not.toContainText(/60\.00|6,000/);await expect(dialog.getByRole('button',{name:'Accept split',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'Show amounts',exact:true}).click();await expect(dialog.getByRole('button',{name:'Accept split',exact:true})).toBeVisible()
})

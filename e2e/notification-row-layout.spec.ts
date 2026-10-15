import {expect,test} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {setupNotifications} from './fixtures/notifications'

const out='test-results/notification-row-layout'
test('two short Food tasks keep a readable text column on a cold production build',async({page})=>{
 const state=await setupNotifications(page)
 state.snapshot.expenses.forEach(e=>{e.description='Food';e.category='Food'})
 state.snapshot.funding.forEach(f=>{f.account_id='bank';f.account_currency='MYR'})
 await page.setViewportSize({width:390,height:844})
 await page.goto('/')
 const bell=page.getByTestId('home-account-notice')
 await expect(bell).toHaveAccessibleName(/2 to do/)
 await bell.click()
 const panel=page.getByTestId('home-notice-popover')
 await expect(panel.locator('.home-notice-row')).toHaveCount(2)
 const metrics=await panel.locator('.home-notice-row').evaluateAll(rows=>rows.map(row=>{
  const copy=row.querySelector('.home-notice-copy')!
  const icon=row.querySelector('.home-notice-icon')!
  return {rowWidth:row.getBoundingClientRect().width,rowHeight:row.getBoundingClientRect().height,copyWidth:copy.getBoundingClientRect().width,iconX:icon.getBoundingClientRect().x,copyX:copy.getBoundingClientRect().x,columns:getComputedStyle(row).gridTemplateColumns}
 }))
 await mkdir(out,{recursive:true})
 await panel.screenshot({path:out+'/food-current.png'})
 await writeFile(out+'/food-current.json',JSON.stringify({metrics,styles:await page.locator('link[rel="stylesheet"]').evaluateAll(links=>links.map(l=>l.getAttribute('href')))},null,2))
 for(const row of metrics){expect(row.copyWidth).toBeGreaterThan(200);expect(row.rowHeight).toBeLessThan(120)}
 await panel.getByRole('button',{name:/Food/}).first().click()
 const dialog=page.getByTestId('notification-target')
 await expect(dialog.getByRole('heading',{name:'Food',exact:true})).toBeVisible()
 const paper=await dialog.evaluate(el=>({width:el.getBoundingClientRect().width,padding:getComputedStyle(el).padding,borderRadius:getComputedStyle(el).borderRadius}))
 expect(paper).toEqual({width:342,padding:'20px',borderRadius:'14px'})
 expect(await dialog.locator('form').evaluate(el=>getComputedStyle(el).gap)).toBe('12px')
 await page.keyboard.press('Escape')
 await expect(panel).toBeVisible()
 await page.getByRole('tab',{name:'Activity',exact:true}).click()
 const accountCopy=panel.locator('.home-notice-copy').first()
 expect((await accountCopy.boundingBox())!.width).toBeGreaterThan(200)
 expect(state.writes).toHaveLength(0)
})

import{expect,type Page}from'@playwright/test'
/** Exercise the actual calendar controls, never assign an input or editor state. */
export async function showTripMonth(page:Page,iso:string){
 await page.getByRole('button',{name:/^Choose month and year:/}).click()
 await page.getByRole('textbox',{name:'Year',exact:true}).fill(iso.slice(0,4))
 await page.getByRole('combobox',{name:'Month',exact:true}).selectOption(String(Number(iso.slice(5,7))))
 await page.getByRole('button',{name:'Go to month',exact:true}).click()
 await expect(page.locator(`[data-date="${iso}"]`)).toBeVisible()
}
export async function chooseTripEndpoint(page:Page,which:'Start'|'End',iso:string){
 const later=page.getByRole('checkbox',{name:'Dates not decided yet',exact:true})
 if(await later.isChecked())await later.uncheck()
 await page.getByRole('button',{name:new RegExp('^'+which+' ')}).click()
 await showTripMonth(page,iso);await page.locator(`[data-date="${iso}"]`).click()
}
export async function chooseTripRange(page:Page,start:string,end:string){await chooseTripEndpoint(page,'Start',start);await chooseTripEndpoint(page,'End',end)}
export async function openTripDates(page:Page){await page.locator('[data-trip-date-trigger]').click();await expect(page.getByTestId('trip-dates-page')).toBeVisible()}

import { expect, type Locator, type Page } from '@playwright/test'
import { openPersonDetail } from './localSupabase'

/** Exercise the approved calculator UI rather than writing to its readonly input. */
export async function enterQuickAmount(dialog: Locator, amount: string): Promise<void> {
  await dialog.getByRole('button', { name: 'Clear calculation', exact: true }).click()
  for (const digit of amount) {
    await dialog.getByRole('button', { name: digit, exact: true }).click()
  }
  const [whole, fraction] = amount.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`)
  await expect(dialog.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue(grouped)
}

export async function fillQuickExpense(dialog: Locator, amount: string, description: string): Promise<void> {
  await dialog.getByRole('button', { name: 'Food', exact: true }).click()
  await enterQuickAmount(dialog, amount)
  await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(description)
}

export async function openFriendTools(page: Page): Promise<void> {
  await expect(page.getByRole('dialog', { name: 'Quick Add', exact: true })).toHaveCount(0)
  const toggle = page.locator('main:not([role="dialog"]) header button.ttsa-icon-button[aria-expanded]')
  await expect(toggle).toBeVisible()
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
  await expect(page.getByRole('button', { name: 'Copy friend invite' })).toBeVisible()
}

export async function openCreateSpace(page: Page): Promise<void> {
  const toggle = page.locator('main > header button[aria-expanded]')
  await expect(toggle).toBeVisible()
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
}

/** A panel obscures the main form, so open/close it through visible controls. */
export async function openQuickSplit(dialog: Locator, page: Page): Promise<Locator> {
  await dialog.getByRole('button', { name: /^Split/ }).click()
  const split = page.getByRole('dialog', { name: 'Split expense', exact: true })
  await expect(split).toBeVisible()
  return split
}

/** Check original immutable split facts, independently of the compact balance card copy. */
export async function expectRecordedManualShare(page: Page, description: string, person: string, amount: string): Promise<void> {
  await expect(page.getByTestId('person-position')).toContainText('On your records')
  const original = page.getByTestId('person-untracked').getByRole('article').filter({ hasText: description })
  await original.getByRole('button', { name: `Edit ${description}`, exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit record', exact: true })
  await editor.getByRole('button', { name: 'Shared expense', exact: true }).click()
  const split = page.getByRole('dialog', { name: 'Split expense', exact: true })
  const manualRow = split.locator('.qa-split-person').filter({ has: page.getByRole('checkbox', { name: person, exact: true }) })
  await expect(manualRow.getByRole('textbox', { name: `Share for ${person}`, exact: true })).toHaveValue(amount)
  await expect(manualRow.getByRole('checkbox', { name: person, exact: true })).toBeChecked()
  await split.getByRole('button', { name: 'Close panel', exact: true }).click()
  await editor.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(editor).toHaveCount(0)
}

/** Follow the shipped notification resolver; never submit a direct test-only RPC. */
export async function openPendingDirectReview(page: Page, description: string): Promise<Locator> {
  await page.goto('/')
  const bell=page.getByTestId('home-account-notice')
  await expect(bell).toBeEnabled();await page.waitForLoadState('networkidle');if(await bell.getAttribute('aria-expanded')!=='true')await bell.click()
  const panel=page.getByTestId('home-notice-popover');await expect(panel).toBeVisible();await panel.getByRole('tab',{name:/To do/}).click()
  const row=page.locator('[data-notice-id^="expense:"]').filter({hasText:description})
  await expect(row).toHaveCount(1);await row.click()
  const review=page.getByTestId('notification-direct-review')
  await expect(review.getByRole('heading',{name:description,exact:true})).toBeVisible()
  return review
}

export async function openPersonActivity(page:Page, person:string):Promise<void>{
  await page.goto('/friends');await openPersonDetail(page,person)
  await expect(page.getByTestId('person-expense-changes')).toBeVisible()
}

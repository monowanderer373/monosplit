import { expect, type Locator, type Page } from '@playwright/test'

/** Exercise the approved calculator UI rather than writing to its readonly input. */
export async function enterQuickAmount(dialog: Locator, amount: string): Promise<void> {
  await dialog.getByRole('button', { name: 'Clear calculation', exact: true }).click()
  for (const digit of amount) {
    await dialog.getByRole('button', { name: digit, exact: true }).click()
  }
  await expect(dialog.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue(amount)
}

export async function fillQuickExpense(dialog: Locator, amount: string, description: string): Promise<void> {
  await dialog.getByRole('button', { name: 'Food', exact: true }).click()
  await enterQuickAmount(dialog, amount)
  await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(description)
}

export async function openFriendTools(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: '+ Add person', exact: true })
  if (await toggle.isVisible()) await toggle.click()
  await expect(page.getByRole('button', { name: 'Copy friend invite' })).toBeVisible()
}

export async function openCreateSpace(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: '+ Create', exact: true })
  if (await toggle.isVisible()) await toggle.click()
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
}

/** A panel obscures the main form, so open/close it through visible controls. */
export async function openQuickSplit(dialog: Locator, page: Page): Promise<Locator> {
  await dialog.getByRole('button', { name: /^Split/ }).click()
  const split = page.getByRole('dialog', { name: 'Split expense', exact: true })
  await expect(split).toBeVisible()
  return split
}

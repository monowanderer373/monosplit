import { addMinor } from './homeView'

export type SpendingEntry = { category: string; date: string; amountMinor: number }
export function summarizeSpending(entries: readonly SpendingEntry[]) {
  const categories = new Map<string, number>()
  const days = new Map<string, number>()
  let totalMinor = 0
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.amountMinor) || entry.amountMinor < 0) throw new Error('Invalid spending amount')
    totalMinor = addMinor(totalMinor, entry.amountMinor)
    categories.set(entry.category, addMinor(categories.get(entry.category) ?? 0, entry.amountMinor))
    days.set(entry.date, addMinor(days.get(entry.date) ?? 0, entry.amountMinor))
  }
  return { totalMinor, categories: [...categories].sort((a,b) => b[1]-a[1]), days: [...days].sort((a,b) => a[0].localeCompare(b[0])) }
}

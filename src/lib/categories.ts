export const EXPENSE_CATEGORIES = [
  'Food',
  'Drinks',
  'Groceries',
  'Transportation',
  'Flight',
  'Accommodation',
  'Shopping',
  'Sightseeing',
  'Activities',
  'Other',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

const legacyMap: Record<string, ExpenseCategory> = {
  food: 'Food',
  drinks: 'Drinks',
  groceries: 'Groceries',
  transport: 'Transportation',
  transportation: 'Transportation',
  flight: 'Flight',
  hotel: 'Accommodation',
  accommodation: 'Accommodation',
  shopping: 'Shopping',
  sightseeing: 'Sightseeing',
  activity: 'Activities',
  activities: 'Activities',
  other: 'Other',
}

export function normalizeCategory(input: string): ExpenseCategory {
  const raw = String(input || '').trim()
  if (!raw) return 'Other'
  const mapped = legacyMap[raw.toLowerCase()]
  if (mapped) return mapped
  const exact = EXPENSE_CATEGORIES.find((category) => category.toLowerCase() === raw.toLowerCase())
  return exact ?? 'Other'
}

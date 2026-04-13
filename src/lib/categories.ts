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
  'Refund',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

// Categories shown in the normal expense category dropdown (excludes Refund — set automatically)
export const SELECTABLE_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => c !== 'Refund')

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
  refund: 'Refund',
  adjustment: 'Refund',
}

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  Food: '🍽️',
  Drinks: '🥤',
  Groceries: '🛒',
  Transportation: '🚌',
  Flight: '✈️',
  Accommodation: '🏨',
  Shopping: '🛍️',
  Sightseeing: '🗺️',
  Activities: '🎯',
  Other: '📌',
  Refund: '↩',
}

export function getCategoryIcon(input: string): string {
  const cat = normalizeCategory(input)
  return CATEGORY_ICONS[cat] ?? '📌'
}

export function normalizeCategory(input: string): ExpenseCategory {
  const raw = String(input || '').trim()
  if (!raw) return 'Other'
  const mapped = legacyMap[raw.toLowerCase()]
  if (mapped) return mapped
  const exact = EXPENSE_CATEGORIES.find((category) => category.toLowerCase() === raw.toLowerCase())
  return exact ?? 'Other'
}

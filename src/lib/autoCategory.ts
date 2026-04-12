import type { ExpenseCategory } from './categories'

/**
 * Keyword → category mapping.
 * Each entry is [keyword, category]. Keywords are matched case-insensitively
 * as whole words or substrings in the description.
 * More specific / longer keywords should be listed first so they win over
 * shorter general ones when iterating.
 */
const RULES: [string, ExpenseCategory][] = [
  // ── Accommodation ────────────────────────────────────────────────────────
  ['airbnb', 'Accommodation'],
  ['ryokan', 'Accommodation'],
  ['hostel', 'Accommodation'],
  ['resort', 'Accommodation'],
  ['hotel', 'Accommodation'],
  ['lodge', 'Accommodation'],
  ['check-in', 'Accommodation'],
  ['check in', 'Accommodation'],
  ['booking', 'Accommodation'],
  ['stay', 'Accommodation'],
  ['room', 'Accommodation'],

  // ── Flight ───────────────────────────────────────────────────────────────
  ['flight', 'Flight'],
  ['airline', 'Flight'],
  ['airfare', 'Flight'],
  ['airport', 'Flight'],
  ['boarding', 'Flight'],

  // ── Transportation ───────────────────────────────────────────────────────
  ['shinkansen', 'Transportation'],
  ['bullet train', 'Transportation'],
  ['subway', 'Transportation'],
  ['transit', 'Transportation'],
  ['train', 'Transportation'],
  ['grab', 'Transportation'],
  ['uber', 'Transportation'],
  ['taxi', 'Transportation'],
  ['tram', 'Transportation'],
  ['ferry', 'Transportation'],
  ['bus', 'Transportation'],
  ['metro', 'Transportation'],
  ['toll', 'Transportation'],
  ['parking', 'Transportation'],
  ['mrt', 'Transportation'],
  ['lrt', 'Transportation'],
  ['ktm', 'Transportation'],
  ['jeepney', 'Transportation'],
  ['tuk tuk', 'Transportation'],
  ['tuktuk', 'Transportation'],
  ['scooter', 'Transportation'],
  ['rental car', 'Transportation'],
  ['car rent', 'Transportation'],

  // ── Groceries ────────────────────────────────────────────────────────────
  ['don quijote', 'Groceries'],
  ['donki', 'Groceries'],
  ['familymart', 'Groceries'],
  ['family mart', 'Groceries'],
  ['seven-eleven', 'Groceries'],
  ['7-eleven', 'Groceries'],
  ['7 eleven', 'Groceries'],
  ['7eleven', 'Groceries'],
  ['lawson', 'Groceries'],
  ['minimart', 'Groceries'],
  ['mini mart', 'Groceries'],
  ['konbini', 'Groceries'],
  ['supermarket', 'Groceries'],
  ['grocery', 'Groceries'],
  ['groceries', 'Groceries'],
  ['market', 'Groceries'],
  ['aeon', 'Groceries'],
  ['watson', 'Groceries'],
  ['guardian', 'Groceries'],
  ['snack', 'Groceries'],
  ['drink', 'Groceries'],
  ['water', 'Groceries'],

  // ── Drinks ───────────────────────────────────────────────────────────────
  ['bubble tea', 'Drinks'],
  ['boba', 'Drinks'],
  ['smoothie', 'Drinks'],
  ['cocktail', 'Drinks'],
  ['beer', 'Drinks'],
  ['wine', 'Drinks'],
  ['sake', 'Drinks'],
  ['latte', 'Drinks'],
  ['matcha', 'Drinks'],
  ['coffee', 'Drinks'],
  ['tea', 'Drinks'],
  ['juice', 'Drinks'],
  ['bar', 'Drinks'],

  // ── Food ─────────────────────────────────────────────────────────────────
  ['breakfast', 'Food'],
  ['brunch', 'Food'],
  ['dinner', 'Food'],
  ['lunch', 'Food'],
  ['ramen', 'Food'],
  ['sushi', 'Food'],
  ['tempura', 'Food'],
  ['yakitori', 'Food'],
  ['tonkatsu', 'Food'],
  ['yakiniku', 'Food'],
  ['teppanyaki', 'Food'],
  ['shabu', 'Food'],
  ['soba', 'Food'],
  ['udon', 'Food'],
  ['takoyaki', 'Food'],
  ['okonomiyaki', 'Food'],
  ['gyoza', 'Food'],
  ['donburi', 'Food'],
  ['bento', 'Food'],
  ['noodle', 'Food'],
  ['nasi', 'Food'],
  ['mee', 'Food'],
  ['laksa', 'Food'],
  ['satay', 'Food'],
  ['curry', 'Food'],
  ['burger', 'Food'],
  ['pizza', 'Food'],
  ['pasta', 'Food'],
  ['steak', 'Food'],
  ['bbq', 'Food'],
  ['hotpot', 'Food'],
  ['hot pot', 'Food'],
  ['dim sum', 'Food'],
  ['dimsum', 'Food'],
  ['restaurant', 'Food'],
  ['izakaya', 'Food'],
  ['cafe', 'Food'],
  ['eatery', 'Food'],
  ['meal', 'Food'],
  ['food', 'Food'],
  ['eat', 'Food'],

  // ── Shopping ─────────────────────────────────────────────────────────────
  ['souvenir', 'Shopping'],
  ['clothing', 'Shopping'],
  ['clothes', 'Shopping'],
  ['uniqlo', 'Shopping'],
  ['zara', 'Shopping'],
  ['h&m', 'Shopping'],
  ['daiso', 'Shopping'],
  ['electronics', 'Shopping'],
  ['drugstore', 'Shopping'],
  ['pharmacy', 'Shopping'],
  ['shopping', 'Shopping'],
  ['shop', 'Shopping'],
  ['mall', 'Shopping'],
  ['duty free', 'Shopping'],
  ['duty-free', 'Shopping'],

  // ── Sightseeing ──────────────────────────────────────────────────────────
  ['ticket', 'Sightseeing'],
  ['entrance', 'Sightseeing'],
  ['admission', 'Sightseeing'],
  ['museum', 'Sightseeing'],
  ['shrine', 'Sightseeing'],
  ['temple', 'Sightseeing'],
  ['castle', 'Sightseeing'],
  ['tour', 'Sightseeing'],
  ['sightseeing', 'Sightseeing'],
  ['landmark', 'Sightseeing'],
  ['gallery', 'Sightseeing'],
  ['zoo', 'Sightseeing'],
  ['aquarium', 'Sightseeing'],

  // ── Activities ───────────────────────────────────────────────────────────
  ['karaoke', 'Activities'],
  ['arcade', 'Activities'],
  ['theme park', 'Activities'],
  ['amusement', 'Activities'],
  ['cinema', 'Activities'],
  ['movie', 'Activities'],
  ['concert', 'Activities'],
  ['show', 'Activities'],
  ['spa', 'Activities'],
  ['onsen', 'Activities'],
  ['hot spring', 'Activities'],
  ['activity', 'Activities'],
  ['hiking', 'Activities'],
  ['cycling', 'Activities'],
  ['diving', 'Activities'],
  ['snorkel', 'Activities'],
  ['surf', 'Activities'],
  ['game', 'Activities'],
  ['sport', 'Activities'],
]

/**
 * Detect the most likely category from a description string.
 * Returns null if no match found (meaning: keep whatever the user set).
 */
export function detectCategory(description: string): ExpenseCategory | null {
  if (!description || description.trim().length < 2) return null
  const lower = description.toLowerCase()
  for (const [keyword, category] of RULES) {
    if (lower.includes(keyword)) return category
  }
  return null
}

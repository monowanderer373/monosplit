import { todayIso, type UniversalQuickAddSession } from './universalQuickAdd'
export function writeQuickDraft(identity: string, session: UniversalQuickAddSession | null) {
  try {
    if (session) localStorage.setItem(`tt-quick-draft:${identity}`, JSON.stringify({ day: todayIso(), session }))
    else localStorage.removeItem(`tt-quick-draft:${identity}`)
  } catch { /* Storage can be unavailable; capture still works. */ }
}
export function readQuickDraft(identity: string): UniversalQuickAddSession | null {
  try {
    const stored = JSON.parse(localStorage.getItem(`tt-quick-draft:${identity}`) || 'null')
    if (!stored || stored.day !== todayIso() || stored.session?.identityKey !== identity || !stored.session?.values || !stored.session?.context?.ref) {
      writeQuickDraft(identity, null)
      return null
    }
    return stored.session
  } catch { return null }
}

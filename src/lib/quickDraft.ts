import { todayIso, type UniversalQuickAddSession } from './universalQuickAdd'

type DraftTarget = { kind: 'personal' } | { kind: 'space'; spaceId: string } | { kind: 'person'; personId: string }
export function quickDraftKey(target: DraftTarget): string {
  return target.kind === 'personal' ? 'personal' : target.kind === 'space' ? `space:${target.spaceId}` : `person:${target.personId}`
}
function loadDrafts(identity: string): Record<string, UniversalQuickAddSession> {
  let stored
  try { stored = JSON.parse(localStorage.getItem(`tt-quick-draft:${identity}`) || 'null') } catch { return {} }
  if (!stored || stored.day !== todayIso()) return {}
  // Upgrade the old single draft without changing its destination.
  const entries = stored.session?.context?.ref
    ? { [quickDraftKey(stored.session.context.ref)]: stored.session }
    : stored.drafts ?? {}
  return Object.fromEntries(Object.entries(entries).filter(([key, value]) => {
    const session = value as UniversalQuickAddSession
    return session?.identityKey === identity && session.values && session.context?.ref
      && key === quickDraftKey(session.context.ref)
  })) as Record<string, UniversalQuickAddSession>
}
export function writeQuickDraft(identity: string, session: UniversalQuickAddSession | null, target?: DraftTarget) {
  try {
    if (!session && !target) { localStorage.removeItem(`tt-quick-draft:${identity}`); return }
    const drafts = loadDrafts(identity)
    if (session?.context) drafts[quickDraftKey(session.context.ref)] = session
    else if (target) delete drafts[quickDraftKey(target)]
    if (Object.keys(drafts).length) localStorage.setItem(`tt-quick-draft:${identity}`, JSON.stringify({ day: todayIso(), version: 2, drafts }))
    else localStorage.removeItem(`tt-quick-draft:${identity}`)
  } catch { /* Storage can be unavailable; capture still works. */ }
}
export function readQuickDraft(identity: string, target: DraftTarget = { kind: 'personal' }): UniversalQuickAddSession | null {
  try { return loadDrafts(identity)[quickDraftKey(target)] ?? null } catch { return null }
}

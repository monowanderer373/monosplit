import type { UserProfile } from '../types'

export function applyProfileEnrichment(
  current: UserProfile | null,
  enriched: UserProfile,
): UserProfile | null {
  return current?.id === enriched.id ? enriched : current
}

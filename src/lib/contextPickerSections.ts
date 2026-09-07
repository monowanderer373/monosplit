import type { MoneyContextRef } from './moneyContext'

export type ContextPickerSections = Readonly<{
  personal: readonly MoneyContextRef[]
  recent: readonly MoneyContextRef[]
  people: readonly MoneyContextRef[]
  groups: readonly MoneyContextRef[]
  trips: readonly MoneyContextRef[]
}>

export function contextIdentityKey(context: MoneyContextRef): string {
  if (context.kind === 'personal') return 'personal'
  if (context.kind === 'person') return `person:${context.personId}`
  return `${context.spaceType}:${context.spaceId}`
}

export function dedupeContextPickerSections(input: {
  personal: readonly MoneyContextRef[]
  recent: readonly MoneyContextRef[]
  people: readonly MoneyContextRef[]
  groups: readonly MoneyContextRef[]
  trips: readonly MoneyContextRef[]
  includeRecent: boolean
}): ContextPickerSections {
  const seen = new Set<string>()
  const takeUnseen = (contexts: readonly MoneyContextRef[]) =>
    contexts.filter((context) => {
      const key = contextIdentityKey(context)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  const personal = takeUnseen(input.personal)
  const recent = input.includeRecent ? takeUnseen(input.recent) : []
  return {
    personal,
    recent,
    people: takeUnseen(input.people),
    groups: takeUnseen(input.groups),
    trips: takeUnseen(input.trips),
  }
}

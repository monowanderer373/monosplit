export type CaptureScope = 'personal' | 'direct' | 'space'
export type CaptureShareMode = 'equal' | 'exact'

export type CaptureDefaultValues = Readonly<{
  scope?: CaptureScope
  spaceId?: string | null
  description?: string | null
  category?: string
  currency?: string
  occurredOn?: string
  participantIds?: readonly string[]
  payerParticipantIds?: readonly string[]
  shareMode?: CaptureShareMode
}>

export type CaptureDefaultSource = CaptureDefaultValues & Readonly<{
  amountMinor?: number
}>

export type CaptureDefaultSourceName =
  | 'provided'
  | 'entryContext'
  | 'template'
  | 'recent'
  | 'profile'

export type CaptureDefaultField = keyof CaptureDefaultValues

export type CaptureDefaultCorrection = Readonly<{
  field: CaptureDefaultField
  selectedSource: CaptureDefaultSourceName
  supersededSources: readonly CaptureDefaultSourceName[]
}>

export type ResolvedCaptureDefaults = Readonly<{
  values: CaptureDefaultValues
  sourceByField: Readonly<Partial<Record<CaptureDefaultField, CaptureDefaultSourceName>>>
  corrections: readonly CaptureDefaultCorrection[]
  reusedAmount: false
}>

const FIELD_ORDER = [
  'scope',
  'spaceId',
  'description',
  'category',
  'currency',
  'occurredOn',
  'participantIds',
  'payerParticipantIds',
  'shareMode',
] as const satisfies readonly CaptureDefaultField[]

function copyValue(
  value: CaptureDefaultValues[CaptureDefaultField],
): CaptureDefaultValues[CaptureDefaultField] {
  return Array.isArray(value) ? [...value] : value
}

function valuesDiffer(
  left: CaptureDefaultValues[CaptureDefaultField],
  right: CaptureDefaultValues[CaptureDefaultField],
): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length !== right.length || left.some((value, index) => value !== right[index])
  }
  return left !== right
}

export function resolveCaptureDefaults(input: Readonly<{
  provided?: CaptureDefaultSource
  entryContext?: CaptureDefaultSource
  template?: CaptureDefaultSource
  recent?: CaptureDefaultSource
  profile?: CaptureDefaultSource
}>): ResolvedCaptureDefaults {
  const sources = [
    ['provided', input.provided],
    ['entryContext', input.entryContext],
    ['template', input.template],
    ['recent', input.recent],
    ['profile', input.profile],
  ] as const satisfies readonly (readonly [
    CaptureDefaultSourceName,
    CaptureDefaultSource | undefined,
  ])[]

  const values: Partial<Record<CaptureDefaultField, CaptureDefaultValues[CaptureDefaultField]>> = {}
  const sourceByField: Partial<Record<CaptureDefaultField, CaptureDefaultSourceName>> = {}
  const corrections: CaptureDefaultCorrection[] = []

  for (const field of FIELD_ORDER) {
    const candidates = sources.filter(([, source]) => source?.[field] !== undefined)
    const selected = candidates[0]
    if (!selected) continue

    const [selectedSource, selectedValues] = selected
    const selectedValue = selectedValues?.[field]
    values[field] = copyValue(selectedValue)
    sourceByField[field] = selectedSource

    const supersededSources = candidates
      .slice(1)
      .filter(([, source]) => valuesDiffer(selectedValue, source?.[field]))
      .map(([sourceName]) => sourceName)

    if (supersededSources.length > 0) {
      corrections.push({ field, selectedSource, supersededSources })
    }
  }

  return {
    values: values as CaptureDefaultValues,
    sourceByField,
    corrections,
    reusedAmount: false,
  }
}

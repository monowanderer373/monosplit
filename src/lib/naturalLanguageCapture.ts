import type { ExpenseCategory } from './categories'
import { CURRENCIES } from './currency'

export type CaptureFieldConfidence = Readonly<{
  amount: number
  currency: number
  description: number
  category: number
  occurredOn: number
}>

export type NaturalLanguageCaptureWarning =
  | 'empty_transcript'
  | 'amount_not_found'
  | 'multiple_amounts'
  | 'currency_not_found'
  | 'ambiguous_currency_symbol'
  | 'conflicting_currencies'
  | 'ambiguous_date'
  | 'ambiguous_category'
  | 'participant_split_requires_review'

export type NaturalLanguageExpenseDraft = Readonly<{
  amount?: string
  currency?: string
  description?: string
  category?: ExpenseCategory
  occurredOn?: string
}>

export type NaturalLanguageCaptureResult = Readonly<{
  source: 'natural_language'
  draft: NaturalLanguageExpenseDraft
  confidence: CaptureFieldConfidence
  warnings: readonly NaturalLanguageCaptureWarning[]
  originalTranscript: string
  requiresReview: false
}>

export type NaturalLanguageCaptureOptions = Readonly<{
  /**
   * Calendar date used to resolve relative words. Requiring it keeps parsing
   * deterministic and avoids depending on the browser or machine timezone.
   */
  referenceDate: string
}>

const SUPPORTED_CODES = CURRENCIES.map(({ code }) => code)

const CATEGORY_KEYWORDS: ReadonlyArray<Readonly<{
  category: ExpenseCategory
  pattern: RegExp
}>> = [
  { category: 'Flight', pattern: /\b(?:flight|airfare|airline|plane)\b/i },
  { category: 'Accommodation', pattern: /\b(?:hotel|hostel|accommodation|lodging|airbnb)\b/i },
  { category: 'Transportation', pattern: /\b(?:taxi|grab|uber|train|bus|metro|transport|toll|petrol|gas)\b/i },
  { category: 'Groceries', pattern: /\b(?:grocer(?:y|ies)|supermarket)\b/i },
  { category: 'Drinks', pattern: /\b(?:drink|drinks|coffee|tea|beer|cocktail)\b/i },
  { category: 'Food', pattern: /\b(?:food|meal|breakfast|lunch|dinner|restaurant|cafe)\b/i },
  { category: 'Shopping', pattern: /\b(?:shopping|souvenir|clothes|clothing)\b/i },
  { category: 'Sightseeing', pattern: /\b(?:sightseeing|museum|temple|attraction)\b/i },
  { category: 'Activities', pattern: /\b(?:activity|activities|tour|ticket|hiking)\b/i },
]

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function previousIsoDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function parseDates(
  transcript: string,
  referenceDate: string,
): { value?: string; confidence: number; ambiguous: boolean } {
  if (!isIsoDate(referenceDate)) {
    throw new Error('referenceDate must be a valid ISO calendar date')
  }

  const candidates: string[] = []
  for (const match of transcript.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
    if (isIsoDate(match[0])) candidates.push(match[0])
  }
  if (/\btoday\b/i.test(transcript)) candidates.push(referenceDate)
  if (/\byesterday\b/i.test(transcript)) candidates.push(previousIsoDate(referenceDate))

  const unique = [...new Set(candidates)]
  if (unique.length > 1) return { confidence: 0, ambiguous: true }
  if (unique.length === 0) return { confidence: 0, ambiguous: false }
  return { value: unique[0], confidence: 1, ambiguous: false }
}

function parseAmounts(transcript: string): {
  value?: string
  confidence: number
  count: number
} {
  // Dates are structural fields, never amount candidates.
  const withoutDates = transcript.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
  const matches = withoutDates.matchAll(/(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![\d.,])/g)
  const values: string[] = []

  for (const match of matches) {
    const normalized = match[0].replaceAll(',', '')
    const numeric = Number(normalized)
    if (Number.isFinite(numeric) && numeric > 0) values.push(normalized)
  }

  if (values.length === 1) return { value: values[0], confidence: 0.95, count: 1 }
  if (values.length > 1) return { confidence: 0, count: values.length }
  return { confidence: 0, count: 0 }
}

type CurrencyCandidate = Readonly<{
  code: string
  confidence: number
  ambiguousSymbol: boolean
}>

function parseCurrency(transcript: string): {
  value?: string
  confidence: number
  ambiguousSymbol: boolean
  conflicting: boolean
} {
  const candidates: CurrencyCandidate[] = []

  for (const code of SUPPORTED_CODES) {
    const pattern = new RegExp(`\\b${code}\\b`, 'i')
    if (pattern.test(transcript)) {
      candidates.push({ code, confidence: 1, ambiguousSymbol: false })
    }
  }

  if (/\bRM(?=\s*\d)/i.test(transcript)) {
    candidates.push({ code: 'MYR', confidence: 0.95, ambiguousSymbol: false })
  }
  if (/(?:^|[^A-Za-z])S\$(?=\s*\d)/i.test(transcript)) {
    candidates.push({ code: 'SGD', confidence: 0.95, ambiguousSymbol: false })
  }
  if (/(?:^|[^A-Za-z])\$(?=\s*\d)/.test(transcript)) {
    candidates.push({ code: 'USD', confidence: 0.5, ambiguousSymbol: true })
  }
  if (/(?:^|[^A-Za-z])¥(?=\s*\d)/.test(transcript)) {
    candidates.push({ code: 'JPY', confidence: 0.5, ambiguousSymbol: true })
  }

  const codes = [...new Set(candidates.map(({ code }) => code))]
  if (codes.length > 1) {
    return { confidence: 0, ambiguousSymbol: false, conflicting: true }
  }
  if (codes.length === 0) {
    return { confidence: 0, ambiguousSymbol: false, conflicting: false }
  }

  const matching = candidates.filter(({ code }) => code === codes[0])
  return {
    value: codes[0],
    confidence: Math.max(...matching.map(({ confidence }) => confidence)),
    ambiguousSymbol: matching.every(({ ambiguousSymbol }) => ambiguousSymbol),
    conflicting: false,
  }
}

function parseCategory(transcript: string): {
  value?: ExpenseCategory
  confidence: number
  ambiguous: boolean
} {
  const matches = CATEGORY_KEYWORDS
    .filter(({ pattern }) => pattern.test(transcript))
    .map(({ category }) => category)
  const unique = [...new Set(matches)]
  if (unique.length > 1) return { confidence: 0, ambiguous: true }
  if (unique.length === 0) return { confidence: 0, ambiguous: false }
  return { value: unique[0], confidence: 0.85, ambiguous: false }
}

function hasParticipantSplitToken(transcript: string): boolean {
  return /\bwith\s+[\p{L}][\p{L}'-]{0,49}\s+(?:split|half)\b/iu.test(transcript)
}

/**
 * Deterministically extracts conservative candidates from a short expense
 * transcript. It performs no I/O, persistence, compilation, or model calls.
 */
export function parseNaturalLanguageCapture(
  originalTranscript: string,
  options: NaturalLanguageCaptureOptions,
): NaturalLanguageCaptureResult {
  const transcript = originalTranscript.trim()
  const amount = parseAmounts(transcript)
  const currency = parseCurrency(transcript)
  const date = parseDates(transcript, options.referenceDate)
  const category = parseCategory(transcript)
  const warnings: NaturalLanguageCaptureWarning[] = []

  if (!transcript) warnings.push('empty_transcript')
  if (amount.count === 0) warnings.push('amount_not_found')
  if (amount.count > 1) warnings.push('multiple_amounts')
  if (!currency.value && !currency.conflicting) warnings.push('currency_not_found')
  if (currency.ambiguousSymbol) warnings.push('ambiguous_currency_symbol')
  if (currency.conflicting) warnings.push('conflicting_currencies')
  if (date.ambiguous) warnings.push('ambiguous_date')
  if (category.ambiguous) warnings.push('ambiguous_category')
  // A name cannot safely become a participant ID without caller-owned lookup.
  if (hasParticipantSplitToken(transcript)) warnings.push('participant_split_requires_review')

  return {
    source: 'natural_language',
    draft: {
      ...(amount.value == null ? {} : { amount: amount.value }),
      ...(currency.value == null ? {} : { currency: currency.value }),
      ...(transcript ? { description: transcript } : {}),
      ...(category.value == null ? {} : { category: category.value }),
      ...(date.value == null ? {} : { occurredOn: date.value }),
    },
    confidence: {
      amount: amount.confidence,
      currency: currency.confidence,
      description: transcript ? 0.7 : 0,
      category: category.confidence,
      occurredOn: date.confidence,
    },
    warnings,
    originalTranscript,
    requiresReview: false,
  }
}

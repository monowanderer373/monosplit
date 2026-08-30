import { CURRENCIES } from './currency'

export type CaptureSource =
  | 'manual'
  | 'template'
  | 'recurring'
  | 'natural_language'
  | 'voice'
  | 'ocr'

export type ExpenseDraftFieldName =
  | 'amount'
  | 'currency'
  | 'description'
  | 'category'
  | 'occurredOn'

export type PartialExpenseDraft = Readonly<{
  amount?: string
  currency?: string
  description?: string
  category?: string
  occurredOn?: string
}>

export type CaptureAdapterOutput = Readonly<{
  source: CaptureSource
  draft: PartialExpenseDraft
  confidence?: Partial<Readonly<Record<ExpenseDraftFieldName, number>>>
  /**
   * Providers such as OCR can require explicit review even when they report
   * high confidence.
   */
  requiresReview?: boolean
}>

export type ReviewResolution =
  | 'missing'
  | 'low_confidence'
  | 'review_required'
  | 'invalid'

export type ExpenseDraftReviewField = Readonly<{
  candidate?: string
  value?: string
  confidence: number
  status: 'resolved' | 'unresolved'
  reviewed: boolean
  resolution?: ReviewResolution
}>

export type ExpenseDraftReviewFields = Readonly<Record<
  ExpenseDraftFieldName,
  ExpenseDraftReviewField
>>

export type ExpenseDraftReviewModel = Readonly<{
  source: CaptureSource
  draft: PartialExpenseDraft
  fields: ExpenseDraftReviewFields
  unresolvedFields: readonly ExpenseDraftFieldName[]
  unresolvedFinancialFields: readonly ('amount' | 'currency')[]
  confidenceThreshold: number
  requiresExplicitReview: boolean
  canConfirm: boolean
}>

export type CreateCaptureReviewOptions = Readonly<{
  confidenceThreshold?: number
  reviewedValues?: PartialExpenseDraft
}>

const FIELD_NAMES: readonly ExpenseDraftFieldName[] = [
  'amount',
  'currency',
  'description',
  'category',
  'occurredOn',
]

const SUPPORTED_CURRENCY_CODES = new Set(CURRENCIES.map(({ code }) => code))

function clampConfidence(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function isCalendarDate(value: string): boolean {
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

function normalizeField(
  field: ExpenseDraftFieldName,
  value: string | undefined,
): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  if (field === 'amount') {
    const normalized = trimmed.replaceAll(',', '')
    if (!/^(?:\d+)(?:\.\d+)?$/.test(normalized)) return undefined
    const numeric = Number(normalized)
    return Number.isFinite(numeric) && numeric > 0 ? normalized : undefined
  }
  if (field === 'currency') {
    const code = trimmed.toUpperCase()
    return SUPPORTED_CURRENCY_CODES.has(code) ? code : undefined
  }
  if (field === 'occurredOn') {
    return isCalendarDate(trimmed) ? trimmed : undefined
  }
  return trimmed
}

function evaluateField(
  field: ExpenseDraftFieldName,
  candidate: string | undefined,
  confidence: number,
  reviewedValue: string | undefined,
  explicitlyReviewed: boolean,
  threshold: number,
  requiresReview: boolean,
): ExpenseDraftReviewField {
  if (explicitlyReviewed) {
    const normalizedReviewed = normalizeField(field, reviewedValue)
    if (normalizedReviewed == null) {
      return {
        ...(candidate == null ? {} : { candidate }),
        confidence,
        status: 'unresolved',
        reviewed: true,
        resolution: 'invalid',
      }
    }
    return {
      ...(candidate == null ? {} : { candidate }),
      value: normalizedReviewed,
      confidence: 1,
      status: 'resolved',
      reviewed: true,
    }
  }

  const normalizedCandidate = normalizeField(field, candidate)
  if (candidate == null || candidate.trim() === '') {
    return {
      confidence,
      status: 'unresolved',
      reviewed: false,
      resolution: 'missing',
    }
  }
  if (normalizedCandidate == null) {
    return {
      candidate,
      confidence,
      status: 'unresolved',
      reviewed: false,
      resolution: 'invalid',
    }
  }
  if (requiresReview) {
    return {
      candidate: normalizedCandidate,
      confidence,
      status: 'unresolved',
      reviewed: false,
      resolution: 'review_required',
    }
  }
  if (confidence < threshold) {
    return {
      candidate: normalizedCandidate,
      confidence,
      status: 'unresolved',
      reviewed: false,
      resolution: 'low_confidence',
    }
  }
  return {
    candidate: normalizedCandidate,
    value: normalizedCandidate,
    confidence,
    status: 'resolved',
    reviewed: false,
  }
}

/**
 * Converts any capture adapter into the same review model. Only normalized,
 * resolved values enter `draft`; candidates remain visible on their fields.
 */
export function createCaptureReview(
  output: CaptureAdapterOutput,
  options: CreateCaptureReviewOptions = {},
): ExpenseDraftReviewModel {
  const confidenceThreshold = options.confidenceThreshold ?? 0.8
  if (
    !Number.isFinite(confidenceThreshold)
    || confidenceThreshold < 0
    || confidenceThreshold > 1
  ) {
    throw new Error('confidenceThreshold must be between 0 and 1')
  }

  const reviewedValues = options.reviewedValues ?? {}
  const requiresExplicitReview = output.requiresReview === true
  const fields = Object.fromEntries(FIELD_NAMES.map((field) => {
    const reviewed = Object.hasOwn(reviewedValues, field)
    return [
      field,
      evaluateField(
        field,
        output.draft[field],
        clampConfidence(output.confidence?.[field]),
        reviewedValues[field],
        reviewed,
        confidenceThreshold,
        requiresExplicitReview,
      ),
    ]
  })) as ExpenseDraftReviewFields

  const draft = Object.fromEntries(FIELD_NAMES.flatMap((field) => {
    const value = fields[field].value
    return value == null ? [] : [[field, value]]
  })) as PartialExpenseDraft
  const unresolvedFields = FIELD_NAMES.filter((field) => fields[field].status === 'unresolved')
  const unresolvedFinancialFields = (['amount', 'currency'] as const)
    .filter((field) => fields[field].status === 'unresolved')

  return {
    source: output.source,
    draft,
    fields,
    unresolvedFields,
    unresolvedFinancialFields,
    confidenceThreshold,
    requiresExplicitReview,
    canConfirm: unresolvedFinancialFields.length === 0,
  }
}

/**
 * Applies caller-confirmed values while retaining unresolved candidates and
 * any values reviewed in an earlier pass.
 */
export function applyReviewedValues(
  review: ExpenseDraftReviewModel,
  reviewedValues: PartialExpenseDraft,
): ExpenseDraftReviewModel {
  const retainedReviewedValues = Object.fromEntries(FIELD_NAMES.flatMap((field) => {
    const current = review.fields[field]
    return current.reviewed && current.value != null ? [[field, current.value]] : []
  })) as PartialExpenseDraft

  const adapterDraft = Object.fromEntries(FIELD_NAMES.flatMap((field) => {
    const candidate = review.fields[field].candidate ?? review.fields[field].value
    return candidate == null ? [] : [[field, candidate]]
  })) as PartialExpenseDraft
  const confidence = Object.fromEntries(
    FIELD_NAMES.map((field) => [field, review.fields[field].confidence]),
  ) as Record<ExpenseDraftFieldName, number>

  return createCaptureReview({
    source: review.source,
    draft: adapterDraft,
    confidence,
    requiresReview: review.requiresExplicitReview,
  }, {
    confidenceThreshold: review.confidenceThreshold,
    reviewedValues: {
      ...retainedReviewedValues,
      ...reviewedValues,
    },
  })
}

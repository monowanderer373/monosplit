import type {
  ExpenseDraftFieldName,
  ExpenseDraftReviewModel,
  PartialExpenseDraft,
} from './capturePipeline'

const CAPTURE_FIELDS = [
  'amount',
  'currency',
  'description',
  'category',
  'occurredOn',
] as const satisfies readonly ExpenseDraftFieldName[]

export type CaptureConfidenceAnalytics = Readonly<{
  averageConfidence: number
  minimumConfidence: number
  amountConfidence: number
  currencyConfidence: number
  descriptionConfidence: number
  categoryConfidence: number
  occurredOnConfidence: number
  candidateFieldCount: number
  unresolvedFieldCount: number
  requiresReview: boolean
}>

export type CaptureCorrectionAnalytics = Readonly<{
  correctionCount: number
  correctionRate: number
  comparedFieldCount: number
}>

function roundRate(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

function normalizeForComparison(field: ExpenseDraftFieldName, value: string): string {
  const trimmed = value.trim()
  if (field === 'currency') return trimmed.toUpperCase()
  if (field === 'amount') {
    const normalized = trimmed.replaceAll(',', '')
    const numeric = Number(normalized)
    return Number.isFinite(numeric) ? String(numeric) : normalized
  }
  return trimmed
}

/**
 * Produces aggregate and per-field confidence metrics without copying any
 * captured values into analytics metadata.
 */
export function summarizeCaptureConfidence(
  review: ExpenseDraftReviewModel,
): CaptureConfidenceAnalytics {
  const confidences = CAPTURE_FIELDS.map((field) => review.fields[field].confidence)
  return {
    averageConfidence: roundRate(
      confidences.reduce((total, confidence) => total + confidence, 0) / confidences.length,
    ),
    minimumConfidence: Math.min(...confidences),
    amountConfidence: review.fields.amount.confidence,
    currencyConfidence: review.fields.currency.confidence,
    descriptionConfidence: review.fields.description.confidence,
    categoryConfidence: review.fields.category.confidence,
    occurredOnConfidence: review.fields.occurredOn.confidence,
    candidateFieldCount: CAPTURE_FIELDS.filter(
      (field) => review.fields[field].candidate != null || review.fields[field].value != null,
    ).length,
    unresolvedFieldCount: review.unresolvedFields.length,
    requiresReview: review.requiresExplicitReview,
  }
}

/**
 * Compares only fields for which capture supplied a candidate. Missing fields
 * filled manually are not parser corrections.
 */
export function summarizeCaptureCorrections(
  review: ExpenseDraftReviewModel,
  reviewedValues: PartialExpenseDraft,
): CaptureCorrectionAnalytics {
  const comparableFields = CAPTURE_FIELDS.filter((field) => {
    const captured = review.fields[field].candidate ?? review.fields[field].value
    return captured != null && reviewedValues[field] != null
  })
  const correctionCount = comparableFields.filter((field) => {
    const captured = review.fields[field].candidate ?? review.fields[field].value
    const reviewed = reviewedValues[field]
    if (captured == null || reviewed == null) return false
    return normalizeForComparison(field, captured) !== normalizeForComparison(field, reviewed)
  }).length

  return {
    correctionCount,
    correctionRate: comparableFields.length === 0
      ? 0
      : roundRate(correctionCount / comparableFields.length),
    comparedFieldCount: comparableFields.length,
  }
}

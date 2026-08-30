import { supabase } from './supabase'

export type ProductEvent = {
  participantId: string | null
  eventName:
    | 'quick_add_started'
    | 'quick_add_saved'
    | 'quick_add_failed'
    | 'default_corrected'
    | 'capture_succeeded'
    | 'capture_failed'
    | 'capture_reviewed'
    | 'capture_manual_fallback'
  source: 'manual' | 'template' | 'recurring' | 'natural_language' | 'voice' | 'ocr'
  durationMs?: number
  succeeded?: boolean
  correctionCount?: number
  metadata?: Record<string, string | number | boolean | null>
}

const NUMERIC_METADATA_KEYS = new Set([
  'averageConfidence',
  'minimumConfidence',
  'amountConfidence',
  'currencyConfidence',
  'descriptionConfidence',
  'categoryConfidence',
  'occurredOnConfidence',
  'candidateFieldCount',
  'unresolvedFieldCount',
  'warningCount',
  'correctionRate',
  'comparedFieldCount',
])
const BOOLEAN_METADATA_KEYS = new Set(['requiresReview'])
const ENUM_METADATA_VALUES: Readonly<Record<string, ReadonlySet<string>>> = {
  scope: new Set(['personal', 'direct', 'space']),
  reason: new Set([
    'invalid_amount',
    'invalid_currency',
    'missing_participant',
    'invalid_participant',
    'invalid_payer',
    'invalid_split',
    'invalid_date',
    'other',
  ]),
  entry: new Set(['deep-link', 'ledger', 'other']),
  failureStage: new Set(['quota', 'voice', 'ocr', 'processing', 'parser']),
  failureReason: new Set([
    'quota_unavailable',
    'permission_denied',
    'unavailable',
    'no_speech',
    'provider_unavailable',
    'invalid_image',
    'image_too_large',
    'no_text',
    'processing_failed',
    'parser_failed',
  ]),
  fallbackReason: new Set(['capture_failed']),
}

/**
 * Analytics metadata is allowlisted here so call sites cannot accidentally
 * persist transcripts, receipt values, amounts, names, or other free text.
 */
export function sanitizeProductEventMetadata(
  metadata: ProductEvent['metadata'],
): Record<string, string | number | boolean | null> {
  if (!metadata) return {}
  const sanitized: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (NUMERIC_METADATA_KEYS.has(key) && typeof value === 'number' && Number.isFinite(value)) {
      sanitized[key] = value
      continue
    }
    if (BOOLEAN_METADATA_KEYS.has(key) && typeof value === 'boolean') {
      sanitized[key] = value
      continue
    }
    const allowedValues = ENUM_METADATA_VALUES[key]
    if (allowedValues && typeof value === 'string') {
      sanitized[key] = allowedValues.has(value) ? value : 'other'
    }
  }
  return sanitized
}

export async function recordProductEvent(event: ProductEvent): Promise<void> {
  if (!supabase) return
  try {
    const { error } = await supabase.from('product_events').insert({
      participant_id: event.participantId,
      event_name: event.eventName,
      source: event.source,
      duration_ms: event.durationMs ?? null,
      succeeded: event.succeeded ?? null,
      correction_count: event.correctionCount ?? null,
      metadata: sanitizeProductEventMetadata(event.metadata),
    })
    if (error) console.warn('[metrics] product event rejected', error.message)
  } catch {
    // Product analytics must never interrupt capture or saving.
    console.warn('[metrics] product event unavailable')
  }
}

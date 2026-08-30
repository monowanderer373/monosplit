export const DEFAULT_MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024

export const SUPPORTED_OCR_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type SupportedOcrImageMimeType = (typeof SUPPORTED_OCR_IMAGE_MIME_TYPES)[number]

export type PrivacySanitizedImage = Readonly<{
  bytes: Uint8Array
  mimeType: string
  /**
   * The caller owns metadata removal/redaction and must attest that it has
   * happened before this boundary accepts the image.
   */
  privacySanitized: true
}>

export type OcrCaptureErrorCode =
  | 'provider_unavailable'
  | 'invalid_image'
  | 'image_too_large'
  | 'no_text'

export type OcrCaptureFailure = Readonly<{
  ok: false
  error: Readonly<{ code: OcrCaptureErrorCode }>
}>

export type OcrCandidate<T> = Readonly<{
  value: T
  confidence: number
}>

export type OcrCandidateFields = Readonly<{
  total?: OcrCandidate<string>
  merchant?: OcrCandidate<string>
  date?: OcrCandidate<string>
}>

export type OcrProviderResult = Readonly<{
  candidates: OcrCandidateFields
}>

export interface OcrProvider {
  extract(image: PrivacySanitizedImage): Promise<OcrProviderResult>
}

export type OcrCaptureSuccess = Readonly<{
  ok: true
  source: 'ocr'
  candidates: OcrCandidateFields
  /**
   * OCR data is always a proposal. The literal flags prevent callers from
   * treating provider output as a confirmable expense without review.
   */
  requiresReview: true
  canConfirm: false
}>

export type OcrCaptureResult = OcrCaptureSuccess | OcrCaptureFailure

export type OcrImageValidationResult =
  | Readonly<{ ok: true }>
  | OcrCaptureFailure

export type OcrValidationOptions = Readonly<{
  maxBytes?: number
}>

export class OcrProviderError extends Error {
  readonly code: 'provider_unavailable' | 'no_text'

  constructor(code: 'provider_unavailable' | 'no_text') {
    super(code)
    this.name = 'OcrProviderError'
    this.code = code
  }
}

/**
 * Pure shape/MIME/size validation. It does not decode, upload, or retain the
 * image. Content-level validation remains the provider's responsibility.
 */
export function validateOcrImage(
  image: PrivacySanitizedImage,
  options: OcrValidationOptions = {},
): OcrImageValidationResult {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_OCR_IMAGE_BYTES
  const supportedMime = SUPPORTED_OCR_IMAGE_MIME_TYPES.some(
    (mimeType) => mimeType === image.mimeType.toLowerCase(),
  )

  if (
    image.privacySanitized !== true
    || !(image.bytes instanceof Uint8Array)
    || image.bytes.byteLength === 0
    || !supportedMime
    || !Number.isSafeInteger(maxBytes)
    || maxBytes <= 0
  ) {
    return { ok: false, error: { code: 'invalid_image' } }
  }
  if (image.bytes.byteLength > maxBytes) {
    return { ok: false, error: { code: 'image_too_large' } }
  }
  return { ok: true }
}

function isCandidatePopulated(candidate: OcrCandidate<string> | undefined): boolean {
  return candidate != null && candidate.value.trim().length > 0
}

function sanitizeCandidate(candidate: OcrCandidate<string> | undefined): OcrCandidate<string> | undefined {
  if (candidate == null || candidate.value.trim().length === 0) return undefined
  const confidence = Number.isFinite(candidate.confidence)
    ? Math.min(1, Math.max(0, candidate.confidence))
    : 0
  return {
    value: candidate.value.trim(),
    confidence,
  }
}

/**
 * Requests candidates from an injected OCR provider. It never manufactures
 * OCR data and exposes no repository, persistence, or expense-compilation API.
 */
export async function captureOcrCandidates(
  image: PrivacySanitizedImage,
  provider: OcrProvider | null | undefined,
  options: OcrValidationOptions = {},
): Promise<OcrCaptureResult> {
  const validation = validateOcrImage(image, options)
  if (!validation.ok) return validation
  if (!provider) {
    return { ok: false, error: { code: 'provider_unavailable' } }
  }

  try {
    const providerResult = await provider.extract(image)
    const total = sanitizeCandidate(providerResult.candidates.total)
    const merchant = sanitizeCandidate(providerResult.candidates.merchant)
    const date = sanitizeCandidate(providerResult.candidates.date)
    const candidates: OcrCandidateFields = {
      ...(total == null ? {} : { total }),
      ...(merchant == null ? {} : { merchant }),
      ...(date == null ? {} : { date }),
    }

    if (
      !isCandidatePopulated(candidates.total)
      && !isCandidatePopulated(candidates.merchant)
      && !isCandidatePopulated(candidates.date)
    ) {
      return { ok: false, error: { code: 'no_text' } }
    }

    return {
      ok: true,
      source: 'ocr',
      candidates,
      requiresReview: true,
      canConfirm: false,
    }
  } catch (error) {
    if (error instanceof OcrProviderError) {
      return { ok: false, error: { code: error.code } }
    }
    return { ok: false, error: { code: 'provider_unavailable' } }
  }
}

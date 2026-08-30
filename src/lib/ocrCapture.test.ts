import { describe, expect, it, vi } from 'vitest'
import {
  captureOcrCandidates,
  OcrProviderError,
  validateOcrImage,
  type OcrProvider,
  type PrivacySanitizedImage,
} from './ocrCapture'

function image(overrides: Partial<PrivacySanitizedImage> = {}): PrivacySanitizedImage {
  return {
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: 'image/jpeg',
    privacySanitized: true,
    ...overrides,
  }
}

describe('validateOcrImage', () => {
  it('accepts supported non-empty images within the size limit', () => {
    expect(validateOcrImage(image(), { maxBytes: 3 })).toEqual({ ok: true })
  })

  it('returns invalid_image for an unsupported MIME or empty bytes', () => {
    expect(validateOcrImage(image({ mimeType: 'application/pdf' }))).toEqual({
      ok: false,
      error: { code: 'invalid_image' },
    })
    expect(validateOcrImage(image({ bytes: new Uint8Array() }))).toEqual({
      ok: false,
      error: { code: 'invalid_image' },
    })
  })

  it('returns image_too_large without invoking a provider', async () => {
    const provider: OcrProvider = { extract: vi.fn() }
    const result = await captureOcrCandidates(image(), provider, { maxBytes: 2 })
    expect(result).toEqual({ ok: false, error: { code: 'image_too_large' } })
    expect(provider.extract).not.toHaveBeenCalled()
  })
})

describe('captureOcrCandidates', () => {
  it('returns provider candidates with mandatory review flags', async () => {
    const input = image()
    const extract = vi.fn(async () => ({
      candidates: {
        total: { value: ' 123.45 ', confidence: 0.92 },
        merchant: { value: ' Cafe ', confidence: 1.2 },
        date: { value: '2026-08-29', confidence: 0.76 },
      },
    }))

    const result = await captureOcrCandidates(input, { extract })
    expect(extract).toHaveBeenCalledWith(input)
    expect(result).toEqual({
      ok: true,
      source: 'ocr',
      candidates: {
        total: { value: '123.45', confidence: 0.92 },
        merchant: { value: 'Cafe', confidence: 1 },
        date: { value: '2026-08-29', confidence: 0.76 },
      },
      requiresReview: true,
      canConfirm: false,
    })
  })

  it('returns provider_unavailable when no provider exists or it fails unexpectedly', async () => {
    await expect(captureOcrCandidates(image(), null)).resolves.toEqual({
      ok: false,
      error: { code: 'provider_unavailable' },
    })

    const provider: OcrProvider = {
      async extract() {
        throw new Error('offline')
      },
    }
    await expect(captureOcrCandidates(image(), provider)).resolves.toEqual({
      ok: false,
      error: { code: 'provider_unavailable' },
    })
  })

  it('returns no_text instead of fabricating candidates', async () => {
    const provider: OcrProvider = {
      async extract() {
        return { candidates: { merchant: { value: '   ', confidence: 0.9 } } }
      },
    }
    await expect(captureOcrCandidates(image(), provider)).resolves.toEqual({
      ok: false,
      error: { code: 'no_text' },
    })
  })

  it('preserves typed provider failures', async () => {
    const unavailable: OcrProvider = {
      async extract() {
        throw new OcrProviderError('provider_unavailable')
      },
    }
    const noText: OcrProvider = {
      async extract() {
        throw new OcrProviderError('no_text')
      },
    }

    await expect(captureOcrCandidates(image(), unavailable)).resolves.toEqual({
      ok: false,
      error: { code: 'provider_unavailable' },
    })
    await expect(captureOcrCandidates(image(), noText)).resolves.toEqual({
      ok: false,
      error: { code: 'no_text' },
    })
  })
})

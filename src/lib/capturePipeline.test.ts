import { describe, expect, it } from 'vitest'
import {
  applyReviewedValues,
  createCaptureReview,
  type CaptureSource,
} from './capturePipeline'
import { parseNaturalLanguageCapture } from './naturalLanguageCapture'

describe('createCaptureReview', () => {
  it.each([
    'manual',
    'template',
    'recurring',
    'natural_language',
    'voice',
    'ocr',
  ] satisfies CaptureSource[])('uses the same review shape for the %s source', (source) => {
    const review = createCaptureReview({
      source,
      draft: { amount: '12.50', currency: 'myr', description: 'Coffee' },
      confidence: { amount: 1, currency: 1, description: 1 },
    })

    expect(review.source).toBe(source)
    expect(review.draft).toEqual({
      amount: '12.50',
      currency: 'MYR',
      description: 'Coffee',
    })
    expect(review.canConfirm).toBe(true)
  })

  it('keeps missing and low-confidence financial candidates unresolved', () => {
    const review = createCaptureReview({
      source: 'natural_language',
      draft: { currency: 'USD', description: 'Taxi $20' },
      confidence: { amount: 0, currency: 0.5, description: 0.7 },
    })

    expect(review.draft.amount).toBeUndefined()
    expect(review.draft.currency).toBeUndefined()
    expect(review.fields.amount.resolution).toBe('missing')
    expect(review.fields.currency).toEqual(expect.objectContaining({
      candidate: 'USD',
      status: 'unresolved',
      resolution: 'low_confidence',
    }))
    expect(review.unresolvedFinancialFields).toEqual(['amount', 'currency'])
    expect(review.canConfirm).toBe(false)
  })

  it('accepts a natural-language adapter result without source-specific logic', () => {
    const adapter = parseNaturalLanguageCapture(
      'Dinner MYR 25 today',
      { referenceDate: '2026-08-30' },
    )
    const review = createCaptureReview(adapter)

    expect(review.draft).toEqual(expect.objectContaining({
      amount: '25',
      currency: 'MYR',
      occurredOn: '2026-08-30',
    }))
    expect(review.canConfirm).toBe(true)
  })

  it('requires explicit caller review when the adapter mandates it', () => {
    const initial = createCaptureReview({
      source: 'ocr',
      draft: { amount: '42.00', currency: 'MYR', description: 'Cafe' },
      confidence: { amount: 0.99, currency: 0.99, description: 0.99 },
      requiresReview: true,
    })

    expect(initial.fields.amount.resolution).toBe('review_required')
    expect(initial.fields.currency.resolution).toBe('review_required')
    expect(initial.canConfirm).toBe(false)

    const reviewed = applyReviewedValues(initial, {
      amount: '42.00',
      currency: 'MYR',
    })
    expect(reviewed.fields.amount.reviewed).toBe(true)
    expect(reviewed.fields.currency.reviewed).toBe(true)
    expect(reviewed.draft).toEqual({
      amount: '42.00',
      currency: 'MYR',
    })
    expect(reviewed.canConfirm).toBe(true)
  })

  it('does not resolve invalid reviewed financial values', () => {
    const initial = createCaptureReview({
      source: 'voice',
      draft: {},
    })
    const reviewed = applyReviewedValues(initial, {
      amount: '-5',
      currency: 'XYZ',
    })

    expect(reviewed.fields.amount).toEqual(expect.objectContaining({
      reviewed: true,
      status: 'unresolved',
      resolution: 'invalid',
    }))
    expect(reviewed.fields.currency.resolution).toBe('invalid')
    expect(reviewed.canConfirm).toBe(false)
  })

  it('normalizes comma-formatted reviewed amounts and preserves earlier reviews', () => {
    const initial = createCaptureReview({
      source: 'template',
      draft: {},
    })
    const amountReviewed = applyReviewedValues(initial, { amount: '1,234.50' })
    const fullyReviewed = applyReviewedValues(amountReviewed, { currency: 'sgd' })

    expect(fullyReviewed.draft.amount).toBe('1234.50')
    expect(fullyReviewed.draft.currency).toBe('SGD')
    expect(fullyReviewed.canConfirm).toBe(true)
  })
})

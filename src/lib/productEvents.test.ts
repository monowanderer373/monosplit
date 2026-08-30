import { describe, expect, it } from 'vitest'
import { sanitizeProductEventMetadata } from './productEvents'

describe('product event metadata', () => {
  it('keeps only allowlisted aggregate analytics', () => {
    expect(sanitizeProductEventMetadata({
      averageConfidence: 0.82,
      correctionRate: 0.4,
      comparedFieldCount: 5,
      requiresReview: true,
      failureStage: 'ocr',
      failureReason: 'no_text',
    })).toEqual({
      averageConfidence: 0.82,
      correctionRate: 0.4,
      comparedFieldCount: 5,
      requiresReview: true,
      failureStage: 'ocr',
      failureReason: 'no_text',
    })
  })

  it('drops captured content and PII-shaped metadata fields', () => {
    const sanitized = sanitizeProductEventMetadata({
      transcript: 'Dinner with Lan',
      merchant: 'Private Cafe',
      amount: 48,
      receiptContent: 'full receipt',
      email: 'person@example.com',
      description: 'Dinner',
      warningCount: 1,
    })

    expect(sanitized).toEqual({ warningCount: 1 })
  })

  it('normalizes unrecognized free-form enum values', () => {
    expect(sanitizeProductEventMetadata({
      entry: 'person@example.com',
      reason: 'contains_private_details',
      failureReason: 'raw provider message',
    })).toEqual({
      entry: 'other',
      reason: 'other',
      failureReason: 'other',
    })
  })
})

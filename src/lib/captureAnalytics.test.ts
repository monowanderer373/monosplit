import { describe, expect, it } from 'vitest'
import { createCaptureReview } from './capturePipeline'
import {
  summarizeCaptureConfidence,
  summarizeCaptureCorrections,
} from './captureAnalytics'

describe('capture analytics', () => {
  it('reports confidence without exposing captured field values', () => {
    const review = createCaptureReview({
      source: 'ocr',
      draft: {
        amount: '48.00',
        currency: 'MYR',
        description: 'Private merchant',
      },
      confidence: {
        amount: 0.9,
        currency: 0.8,
        description: 0.7,
      },
      requiresReview: true,
    })

    const analytics = summarizeCaptureConfidence(review)

    expect(analytics).toEqual({
      averageConfidence: 0.48,
      minimumConfidence: 0,
      amountConfidence: 0.9,
      currencyConfidence: 0.8,
      descriptionConfidence: 0.7,
      categoryConfidence: 0,
      occurredOnConfidence: 0,
      candidateFieldCount: 3,
      unresolvedFieldCount: 5,
      requiresReview: true,
    })
    expect(JSON.stringify(analytics)).not.toContain('Private merchant')
    expect(JSON.stringify(analytics)).not.toContain('48.00')
  })

  it('counts changed captured candidates and returns a bounded correction rate', () => {
    const review = createCaptureReview({
      source: 'natural_language',
      draft: {
        amount: '48',
        currency: 'MYR',
        description: 'Dinner',
        category: 'Food',
      },
      confidence: {
        amount: 0.95,
        currency: 1,
        description: 0.7,
        category: 0.85,
      },
      requiresReview: true,
    })

    expect(summarizeCaptureCorrections(review, {
      amount: '48.00',
      currency: 'myr',
      description: 'Dinner and drinks',
      category: 'Drinks',
      occurredOn: '2026-08-30',
    })).toEqual({
      correctionCount: 2,
      correctionRate: 0.5,
      comparedFieldCount: 4,
    })
  })

  it('does not treat manually filled missing fields as corrections', () => {
    const review = createCaptureReview({
      source: 'voice',
      draft: {},
      requiresReview: true,
    })

    expect(summarizeCaptureCorrections(review, {
      amount: '12',
      currency: 'MYR',
    })).toEqual({
      correctionCount: 0,
      correctionRate: 0,
      comparedFieldCount: 0,
    })
  })
})

import { describe, expect, it } from 'vitest'
import { shouldApplyHomeResult } from './useHomeData'

describe('home data identity', () => {
  it('rejects a response that belongs to a different participant', () => {
    expect(shouldApplyHomeResult('owner-a', 'owner-a')).toBe(true)
    expect(shouldApplyHomeResult('owner-a', 'owner-b')).toBe(false)
    expect(shouldApplyHomeResult('owner-a', null)).toBe(false)
  })
})

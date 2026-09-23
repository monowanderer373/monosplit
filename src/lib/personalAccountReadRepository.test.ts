import { describe, expect, it } from 'vitest'
import { addStoredMinor, readAllPages } from './personalAccountReadRepository'

describe('personal account reads', () => {
  it('pages until a short page and rejects unsafe balance sums', async () => {
    const pages = [
      Array.from({ length: 2 }, (_, index) => index),
      [2],
    ]
    const rows = await readAllPages(async (from) => pages[from === 0 ? 0 : 1] ?? [], 2)
    expect(rows).toEqual([0, 1, 2])
    expect(addStoredMinor(10, 5)).toBe(15)
    expect(() => addStoredMinor(Number.MAX_SAFE_INTEGER, 1)).toThrow('amount_overflow')
  })
})

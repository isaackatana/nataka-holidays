import { describe, it, expect } from 'vitest'
import { ratingBreakdown } from './ratings'

describe('ratingBreakdown', () => {
  it('lists 5 stars down to 1 with counts and percentages', () => {
    const result = ratingBreakdown([5, 5, 4, 1])
    expect(result.map((b) => b.stars)).toEqual([5, 4, 3, 2, 1])
    expect(result.map((b) => b.count)).toEqual([2, 1, 0, 0, 1])
    expect(result.map((b) => b.percent)).toEqual([50, 25, 0, 0, 25])
  })

  it('returns zeros for no reviews', () => {
    expect(ratingBreakdown([]).every((b) => b.count === 0 && b.percent === 0)).toBe(true)
  })
})

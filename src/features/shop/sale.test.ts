import { describe, expect, it } from 'vitest'
import { isOnSale, salePercent } from '@/features/shop/sale'

describe('salePercent', () => {
  it('works out the percent off', () => {
    expect(salePercent(800, 1000)).toBe(20)
    expect(salePercent(500, 1500)).toBe(67)
    expect(salePercent(1, 3)).toBe(67)
  })
  it('is null when it is not a sale', () => {
    expect(salePercent(800, null)).toBeNull()
    expect(salePercent(800, undefined)).toBeNull()
    expect(salePercent(800, 800)).toBeNull()
    expect(salePercent(800, 500)).toBeNull()
    expect(salePercent(0, 500)).toBeNull()
  })
  it('ignores a discount that rounds to nothing', () => {
    expect(salePercent(9999, 10000)).toBeNull()
  })
})

describe('isOnSale', () => {
  it('follows salePercent', () => {
    expect(isOnSale({ price: 800, compare_at_price: 1000 })).toBe(true)
    expect(isOnSale({ price: 800 })).toBe(false)
  })
})

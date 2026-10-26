import { describe, expect, it } from 'vitest'
import { discountLabel, discountState } from '@/features/shop/discountLabel'
import type { DiscountCode } from '@/types/domain'

const code = (over: Partial<DiscountCode> = {}): DiscountCode => ({
  id: '1', code: 'TEN', kind: 'percent', value: 10, min_subtotal: 0, max_uses: null, uses: 0,
  once_per_guest: true, expires_at: null, is_active: true, created_at: '', ...over,
})

describe('discountLabel', () => {
  it('words a percentage and a fixed amount', () => {
    expect(discountLabel(code())).toBe('10% off')
    expect(discountLabel(code({ kind: 'amount', value: 500 }))).toMatch(/500 off$/)
  })
})

describe('discountState', () => {
  const now = new Date('2026-11-01T12:00:00Z').getTime()
  it('is working by default', () => expect(discountState(code(), now)).toBe('on'))
  it('is off when switched off', () => expect(discountState(code({ is_active: false }), now)).toBe('off'))
  it('is expired after its last day', () => {
    expect(discountState(code({ expires_at: '2026-10-31T20:59:59Z' }), now)).toBe('expired')
    expect(discountState(code({ expires_at: '2026-11-05T20:59:59Z' }), now)).toBe('on')
  })
  it('is fully used when the limit is reached', () => {
    expect(discountState(code({ max_uses: 5, uses: 5 }), now)).toBe('used-up')
    expect(discountState(code({ max_uses: 5, uses: 4 }), now)).toBe('on')
  })
  it('switched off wins over everything else', () => {
    expect(discountState(code({ is_active: false, max_uses: 1, uses: 1 }), now)).toBe('off')
  })
})

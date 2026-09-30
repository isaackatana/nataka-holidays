import { describe, expect, it } from 'vitest'
import { sumPaid } from './payments'

describe('sumPaid', () => {
  it('counts only successful payments', () => {
    expect(
      sumPaid([
        { status: 'success', amount: 10000, paid_amount: 10000 },
        { status: 'pending', amount: 5000, paid_amount: null },
        { status: 'failed', amount: 7000, paid_amount: null },
      ]),
    ).toBe(10000)
  })

  it('prefers the amount Safaricom reports as paid', () => {
    expect(sumPaid([{ status: 'success', amount: 10000, paid_amount: 9000 }])).toBe(9000)
  })

  it('falls back to the requested amount and handles empty input', () => {
    expect(sumPaid([{ status: 'success', amount: 4000, paid_amount: null }])).toBe(4000)
    expect(sumPaid([])).toBe(0)
  })
})

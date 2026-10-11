import { describe, expect, it } from 'vitest'
import { findStuckPayments, manualPaymentError, manualPaymentTimestamp, sumPaid } from './payments'

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

describe('manualPaymentError', () => {
  const today = '2026-10-02'
  it('accepts a normal payment', () => {
    expect(manualPaymentError({ amount: 25000, date: '2026-10-01', today })).toBeNull()
    expect(manualPaymentError({ amount: 25000, date: today, today })).toBeNull()
  })
  it('rejects bad amounts', () => {
    expect(manualPaymentError({ amount: 0, date: today, today })).toMatch(/whole number/)
    expect(manualPaymentError({ amount: 10.5, date: today, today })).toMatch(/whole number/)
    expect(manualPaymentError({ amount: Number.NaN, date: today, today })).toMatch(/whole number/)
    expect(manualPaymentError({ amount: 10_000_001, date: today, today })).toMatch(/too large/)
  })
  it('rejects missing or future dates', () => {
    expect(manualPaymentError({ amount: 100, date: '', today })).toMatch(/Choose the date/)
    expect(manualPaymentError({ amount: 100, date: '2026-10-03', today })).toMatch(/future/)
  })
  it('timestamps at midday East Africa Time', () => {
    expect(manualPaymentTimestamp('2026-10-01')).toBe('2026-10-01T12:00:00+03:00')
    expect(new Date(manualPaymentTimestamp('2026-10-01')).toISOString()).toBe('2026-10-01T09:00:00.000Z')
  })
})

describe('findStuckPayments', () => {
  const now = new Date('2026-10-11T12:00:00Z').getTime()
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString()

  it('flags M-Pesa prompts still pending after five minutes', () => {
    const stuck = { id: 'a', status: 'pending' as const, method: 'mpesa' as const, created_at: at(6) }
    expect(findStuckPayments([stuck], now)).toEqual([stuck])
    expect(findStuckPayments([{ ...stuck, created_at: at(5) }], now)).toHaveLength(1)
  })

  it('leaves recent prompts alone', () => {
    expect(
      findStuckPayments([{ status: 'pending', method: 'mpesa', created_at: at(2) }], now),
    ).toEqual([])
  })

  it('ignores resolved payments and non-M-Pesa entries', () => {
    expect(
      findStuckPayments(
        [
          { status: 'success', method: 'mpesa', created_at: at(60) },
          { status: 'failed', method: 'mpesa', created_at: at(60) },
          { status: 'pending', method: 'cash', created_at: at(60) },
        ],
        now,
      ),
    ).toEqual([])
  })
})

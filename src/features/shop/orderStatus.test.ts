import { describe, expect, it } from 'vitest'
import { isAwaitingPayment } from './orderStatus'

const now = new Date('2026-10-13T12:00:00Z').getTime()
const soon = new Date(now + 60_000).toISOString()
const past = new Date(now - 60_000).toISOString()

describe('isAwaitingPayment', () => {
  it('is true only for an unpaid order still inside its hold time', () => {
    expect(isAwaitingPayment({ status: 'pending_payment', expires_at: soon }, now)).toBe(true)
    expect(isAwaitingPayment({ status: 'pending_payment', expires_at: past }, now)).toBe(false)
    for (const status of ['paid', 'packed', 'completed', 'cancelled', 'expired'] as const) {
      expect(isAwaitingPayment({ status, expires_at: soon }, now)).toBe(false)
    }
  })
})

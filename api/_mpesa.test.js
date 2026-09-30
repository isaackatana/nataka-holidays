import { describe, expect, it } from 'vitest'
import { darajaTimestamp, normalizeKenyanPhone, parseStkCallback, selfPayError } from './_mpesa.js'

describe('normalizeKenyanPhone', () => {
  it.each([
    ['0712 345 678', '254712345678'],
    ['+254 712 345 678', '254712345678'],
    ['254712345678', '254712345678'],
    ['712345678', '254712345678'],
    ['0112345678', '254112345678'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected)
  })

  it.each(['', null, '12345', '0812345678', '25471234567', '+1 415 555 0100'])('rejects %s', (input) => {
    expect(normalizeKenyanPhone(input)).toBeNull()
  })
})

describe('darajaTimestamp', () => {
  it('formats in East Africa Time', () => {
    expect(darajaTimestamp(new Date('2026-09-30T22:30:05Z'))).toBe('20261001013005')
  })
})

describe('parseStkCallback', () => {
  it('parses a successful callback', () => {
    const body = {
      Body: {
        stkCallback: {
          CheckoutRequestID: 'ws_CO_1',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 1500.0 },
              { Name: 'MpesaReceiptNumber', Value: 'SIA1B2C3D4' },
            ],
          },
        },
      },
    }
    expect(parseStkCallback(body)).toEqual({
      checkoutRequestId: 'ws_CO_1',
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
      receipt: 'SIA1B2C3D4',
      amount: 1500,
    })
  })

  it('parses a cancelled callback without metadata', () => {
    const parsed = parseStkCallback({
      Body: { stkCallback: { CheckoutRequestID: 'ws_CO_2', ResultCode: 1032, ResultDesc: 'Request cancelled by user' } },
    })
    expect(parsed).toMatchObject({ resultCode: 1032, receipt: null, amount: null })
  })

  it('returns null for malformed bodies', () => {
    expect(parseStkCallback(undefined)).toBeNull()
    expect(parseStkCallback({ Body: {} })).toBeNull()
  })
})

describe('selfPayError', () => {
  const now = new Date('2026-10-01T12:00:00Z').getTime()
  const booking = { customer_id: 'u1', status: 'confirmed', estimated_total: 100000 }
  const base = { booking, userId: 'u1', payments: [], amount: 30000, now }

  it('allows a valid deposit', () => {
    expect(selfPayError(base)).toBeNull()
  })

  it("blocks someone else's booking and unconfirmed bookings", () => {
    expect(selfPayError({ ...base, userId: 'u2' })).toMatch(/not your booking/)
    expect(selfPayError({ ...base, userId: null })).toMatch(/not your booking/)
    expect(selfPayError({ ...base, booking: { ...booking, status: 'pending' } })).toMatch(/confirmed/)
    expect(selfPayError({ ...base, booking: { ...booking, estimated_total: null } })).toMatch(/no total/)
  })

  it('caps the amount at the unpaid balance', () => {
    const payments = [{ status: 'success', amount: 30000, paid_amount: 30000, created_at: '2026-09-01T00:00:00Z' }]
    expect(selfPayError({ ...base, payments, amount: 70000 })).toBeNull()
    expect(selfPayError({ ...base, payments, amount: 70001 })).toMatch(/most you can pay/)
    const full = [{ status: 'success', amount: 100000, paid_amount: 100000, created_at: '2026-09-01T00:00:00Z' }]
    expect(selfPayError({ ...base, payments: full, amount: 1 })).toMatch(/fully paid/)
  })

  it('ignores failed payments but blocks a fresh pending prompt', () => {
    const failed = [{ status: 'failed', amount: 30000, paid_amount: null, created_at: '2026-10-01T11:59:00Z' }]
    expect(selfPayError({ ...base, payments: failed })).toBeNull()
    const fresh = [{ status: 'pending', amount: 30000, paid_amount: null, created_at: '2026-10-01T11:59:00Z' }]
    expect(selfPayError({ ...base, payments: fresh })).toMatch(/just sent/)
    const stale = [{ status: 'pending', amount: 30000, paid_amount: null, created_at: '2026-10-01T11:50:00Z' }]
    expect(selfPayError({ ...base, payments: stale })).toBeNull()
  })
})

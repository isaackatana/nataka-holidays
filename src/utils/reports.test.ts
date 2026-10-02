import { describe, expect, it } from 'vitest'
import {
  bookingsToCsv, buildReport, csvCell, daysBetween, nightsInWindow, periodWindow, upcomingArrivals,
  type ReportBooking, type ReportPayment,
} from './reports'

const booking = (over: Partial<ReportBooking>): ReportBooking => ({
  id: 'b1', property_id: 'p1', guest_name: 'Amina', guest_phone: '0712345678',
  check_in: '2026-10-10', check_out: '2026-10-14', guests: 2, estimated_total: 100000,
  status: 'confirmed', created_at: '2026-09-20T08:00:00Z', properties: { title: 'Beach Villa' }, ...over,
})
const payment = (over: Partial<ReportPayment>): ReportPayment => ({
  booking_id: 'b1', amount: 30000, paid_amount: 30000, status: 'success', created_at: '2026-10-02T09:00:00Z', ...over,
})
const properties = [{ id: 'p1', title: 'Beach Villa' }, { id: 'p2', title: 'Garden Cottage' }]

describe('periodWindow', () => {
  it('computes calendar periods, including year boundaries', () => {
    expect(periodWindow('this-month', '2026-10-02')).toEqual({ from: '2026-10-01', to: '2026-11-01', days: 31 })
    expect(periodWindow('this-month', '2026-12-15')).toEqual({ from: '2026-12-01', to: '2027-01-01', days: 31 })
    expect(periodWindow('last-month', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2026-01-01', days: 31 })
    expect(periodWindow('next-30', '2026-10-02')).toMatchObject({ from: '2026-10-02', to: '2026-11-01', days: 30 })
    expect(periodWindow('last-90', '2026-10-02').days).toBe(90)
    expect(periodWindow('this-year', '2026-10-02')).toEqual({ from: '2026-01-01', to: '2027-01-01', days: 365 })
  })
})

describe('nightsInWindow', () => {
  const w = { from: '2026-10-01', to: '2026-11-01', days: 31 }
  it('counts only nights inside the window', () => {
    expect(nightsInWindow('2026-10-10', '2026-10-14', w)).toBe(4)
    expect(nightsInWindow('2026-09-28', '2026-10-03', w)).toBe(2) // starts before
    expect(nightsInWindow('2026-10-30', '2026-11-04', w)).toBe(2) // ends after
    expect(nightsInWindow('2026-11-05', '2026-11-08', w)).toBe(0)
  })
  it('daysBetween', () => expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3))
})

describe('buildReport', () => {
  const window = periodWindow('this-month', '2026-10-02')

  it('counts only confirmed and completed bookings', () => {
    const bookings = [
      booking({ id: 'b1' }),
      booking({ id: 'b2', status: 'pending' }),
      booking({ id: 'b3', status: 'cancelled' }),
      booking({ id: 'b4', status: 'completed', check_in: '2026-10-20', check_out: '2026-10-22', estimated_total: 50000 }),
    ]
    const r = buildReport({ bookings, payments: [], properties, window })
    expect(r.bookingsStarting).toBe(2)
    expect(r.bookedValue).toBe(150000)
    expect(r.perProperty.find((p) => p.propertyId === 'p1')).toMatchObject({ bookings: 2, bookedNights: 6 })
  })

  it('computes occupancy per property and keeps unbooked properties', () => {
    const r = buildReport({ bookings: [booking({})], payments: [], properties, window })
    expect(r.perProperty[0].propertyId).toBe('p1')
    expect(r.perProperty[0].occupancy).toBeCloseTo(4 / 31)
    expect(r.perProperty[1]).toMatchObject({ propertyId: 'p2', bookedNights: 0, occupancy: 0 })
  })

  it('collects only successful payments made inside the window', () => {
    const payments = [
      payment({}),
      payment({ status: 'pending', amount: 9999 }),
      payment({ status: 'failed', amount: 8888 }),
      payment({ created_at: '2026-09-15T09:00:00Z', amount: 5000, paid_amount: 5000 }), // last month
    ]
    const r = buildReport({ bookings: [booking({})], payments, properties, window })
    expect(r.collected).toBe(30000)
    expect(r.perProperty[0].collected).toBe(30000)
  })

  it('outstanding balance spans all periods and ignores unconfirmed bookings', () => {
    const bookings = [
      booking({ id: 'b1' }),
      booking({ id: 'b2', check_in: '2027-03-01', check_out: '2027-03-03', estimated_total: 40000 }),
      booking({ id: 'b3', status: 'pending', estimated_total: 77777 }),
    ]
    const payments = [payment({ booking_id: 'b1', amount: 30000, paid_amount: 30000 })]
    const r = buildReport({ bookings, payments, properties, window })
    expect(r.outstanding).toBe(70000 + 40000)
  })

  it('conversion is the share of enquiries created in the window that went live', () => {
    const bookings = [
      booking({ id: 'a', created_at: '2026-10-01T00:00:00Z' }),
      booking({ id: 'b', status: 'pending', created_at: '2026-10-01T00:00:00Z' }),
      booking({ id: 'c', status: 'cancelled', created_at: '2026-10-01T00:00:00Z' }),
      booking({ id: 'd', created_at: '2026-08-01T00:00:00Z' }), // outside window
    ]
    const r = buildReport({ bookings, payments: [], properties, window })
    expect(r.enquiriesReceived).toBe(3)
    expect(r.conversion).toBeCloseTo(1 / 3)
    expect(buildReport({ bookings: [], payments: [], properties, window }).conversion).toBeNull()
  })
})

describe('upcomingArrivals', () => {
  it('lists confirmed arrivals soonest first with their balance', () => {
    const bookings = [
      booking({ id: 'late', check_in: '2026-10-12' }),
      booking({ id: 'soon', check_in: '2026-10-03', estimated_total: 20000 }),
      booking({ id: 'far', check_in: '2026-12-01' }),
      booking({ id: 'pend', check_in: '2026-10-04', status: 'pending' }),
    ]
    const result = upcomingArrivals(bookings, [payment({ booking_id: 'soon', amount: 20000, paid_amount: 20000 })], '2026-10-02', 14)
    expect(result.map((a) => a.booking.id)).toEqual(['soon', 'late'])
    expect(result[0].balance).toBe(0)
    expect(result[1].balance).toBe(100000)
  })
})

describe('CSV', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Smith, Jo')).toBe('"Smith, Jo"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(null)).toBe('')
  })

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"')
    expect(csvCell('+254712345678')).toBe("'+254712345678")
    expect(csvCell('-5')).toBe("'-5")
  })

  it('exports a header row and one row per booking with paid and balance', () => {
    const csv = bookingsToCsv([booking({})], [payment({})])
    const [header, row] = csv.split('\r\n')
    expect(header.startsWith('Guest,Phone,Property')).toBe(true)
    expect(row).toBe('Amina,0712345678,Beach Villa,2026-10-10,2026-10-14,4,2,confirmed,100000,30000,70000')
  })
})

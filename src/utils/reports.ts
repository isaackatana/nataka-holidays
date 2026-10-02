// Pure calculations for the admin Reports page. Dates are 'yyyy-mm-dd'
// strings; a stay of [check_in, check_out) occupies the nights from
// check_in up to, not including, check_out.
import { addDays } from '@/utils/availability'
import { sumPaid, type PaymentStatus } from '@/utils/payments'

export type ReportPeriod = 'this-month' | 'last-month' | 'next-30' | 'last-90' | 'this-year'

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'next-30': 'Next 30 days',
  'last-90': 'Last 90 days',
  'this-year': 'This year',
}

export interface DateWindow {
  /** Inclusive start, exclusive end: [from, to). */
  from: string
  to: string
  days: number
}

export interface ReportBooking {
  id: string
  property_id: string | null
  guest_name: string
  guest_phone: string
  check_in: string
  check_out: string
  guests: number
  estimated_total: number | null
  status: 'pending' | 'contacted' | 'confirmed' | 'cancelled' | 'completed'
  created_at: string
  properties: { title: string } | null
}

export interface ReportPayment {
  booking_id: string
  amount: number
  paid_amount: number | null
  status: PaymentStatus
  created_at: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

export function periodWindow(period: ReportPeriod, today: string): DateWindow {
  const [y, m] = today.split('-').map(Number)
  let from: string
  let to: string
  switch (period) {
    case 'this-month':
      from = iso(y, m, 1)
      to = m === 12 ? iso(y + 1, 1, 1) : iso(y, m + 1, 1)
      break
    case 'last-month':
      from = m === 1 ? iso(y - 1, 12, 1) : iso(y, m - 1, 1)
      to = iso(y, m, 1)
      break
    case 'next-30':
      from = today
      to = addDays(today, 30)
      break
    case 'last-90':
      from = addDays(today, -90)
      to = today
      break
    case 'this-year':
      from = iso(y, 1, 1)
      to = iso(y + 1, 1, 1)
      break
  }
  return { from, to, days: daysBetween(from, to) }
}

/** Nights of [checkIn, checkOut) that fall inside [from, to). */
export function nightsInWindow(checkIn: string, checkOut: string, window: DateWindow): number {
  const start = checkIn > window.from ? checkIn : window.from
  const end = checkOut < window.to ? checkOut : window.to
  return Math.max(0, daysBetween(start, end))
}

const isLive = (b: ReportBooking) => b.status === 'confirmed' || b.status === 'completed'
const inWindow = (date: string, w: DateWindow) => date >= w.from && date < w.to
const dayOf = (timestamp: string) => timestamp.slice(0, 10)

export interface PropertyRow {
  propertyId: string
  title: string
  bookings: number
  bookedNights: number
  /** 0..1 share of the window's nights that are booked. */
  occupancy: number
  bookedValue: number
  collected: number
}

export interface Report {
  collected: number
  bookedValue: number
  bookingsStarting: number
  conversion: number | null
  enquiriesReceived: number
  /** Balance still owed on every confirmed/completed booking, whenever it falls. */
  outstanding: number
  perProperty: PropertyRow[]
}

export function buildReport(input: {
  bookings: ReportBooking[]
  payments: ReportPayment[]
  properties: { id: string; title: string }[]
  window: DateWindow
}): Report {
  const { bookings, payments, properties, window } = input
  const paymentsByBooking = new Map<string, ReportPayment[]>()
  for (const p of payments) {
    const list = paymentsByBooking.get(p.booking_id) ?? []
    list.push(p)
    paymentsByBooking.set(p.booking_id, list)
  }
  const bookingById = new Map(bookings.map((b) => [b.id, b]))

  const rows = new Map<string, PropertyRow>()
  for (const p of properties) {
    rows.set(p.id, { propertyId: p.id, title: p.title, bookings: 0, bookedNights: 0, occupancy: 0, bookedValue: 0, collected: 0 })
  }

  let bookedValue = 0
  let bookingsStarting = 0
  for (const b of bookings) {
    if (!isLive(b)) continue
    const row = b.property_id ? rows.get(b.property_id) : undefined
    if (row) row.bookedNights += nightsInWindow(b.check_in, b.check_out, window)
    if (inWindow(b.check_in, window)) {
      bookingsStarting += 1
      bookedValue += b.estimated_total ?? 0
      if (row) {
        row.bookings += 1
        row.bookedValue += b.estimated_total ?? 0
      }
    }
  }

  let collected = 0
  for (const pay of payments) {
    if (pay.status !== 'success' || !inWindow(dayOf(pay.created_at), window)) continue
    const amount = pay.paid_amount ?? pay.amount
    collected += amount
    const booking = bookingById.get(pay.booking_id)
    const row = booking?.property_id ? rows.get(booking.property_id) : undefined
    if (row) row.collected += amount
  }

  let outstanding = 0
  for (const b of bookings) {
    if (!isLive(b) || b.estimated_total == null) continue
    outstanding += Math.max(b.estimated_total - sumPaid(paymentsByBooking.get(b.id) ?? []), 0)
  }

  const created = bookings.filter((b) => inWindow(dayOf(b.created_at), window))
  const converted = created.filter(isLive).length

  const perProperty = [...rows.values()]
    .map((r) => ({ ...r, occupancy: window.days > 0 ? Math.min(r.bookedNights / window.days, 1) : 0 }))
    .sort((a, b) => b.bookedValue - a.bookedValue || b.bookedNights - a.bookedNights || a.title.localeCompare(b.title))

  return {
    collected,
    bookedValue,
    bookingsStarting,
    conversion: created.length > 0 ? converted / created.length : null,
    enquiriesReceived: created.length,
    outstanding,
    perProperty,
  }
}

export interface Arrival {
  booking: ReportBooking
  balance: number
}

/** Confirmed bookings arriving in [today, today + days), soonest first. */
export function upcomingArrivals(
  bookings: ReportBooking[],
  payments: ReportPayment[],
  today: string,
  days: number,
): Arrival[] {
  const end = addDays(today, days)
  return bookings
    .filter((b) => b.status === 'confirmed' && b.check_in >= today && b.check_in < end)
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
    .map((booking) => ({
      booking,
      balance: Math.max(
        (booking.estimated_total ?? 0) - sumPaid(payments.filter((p) => p.booking_id === booking.id)),
        0,
      ),
    }))
}

/** One CSV cell. Quotes and escapes, and neutralises spreadsheet formulas:
 * a guest could type "=HYPERLINK(...)" as their name, and Excel/Sheets would
 * run it when the file is opened. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function bookingsToCsv(bookings: ReportBooking[], payments: ReportPayment[]): string {
  const header = ['Guest', 'Phone', 'Property', 'Check-in', 'Check-out', 'Nights', 'Guests', 'Status', 'Total (KSh)', 'Paid (KSh)', 'Balance (KSh)']
  const lines = bookings.map((b) => {
    const paid = sumPaid(payments.filter((p) => p.booking_id === b.id))
    const total = b.estimated_total
    return [
      b.guest_name,
      b.guest_phone,
      b.properties?.title ?? 'Deleted property',
      b.check_in,
      b.check_out,
      daysBetween(b.check_in, b.check_out),
      b.guests,
      b.status,
      total ?? '',
      paid,
      total != null ? Math.max(total - paid, 0) : '',
    ].map(csvCell).join(',')
  })
  return [header.map(csvCell).join(','), ...lines].join('\r\n')
}

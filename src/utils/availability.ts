// Pure date logic for the availability calendar. Dates are 'yyyy-mm-dd'
// strings. A booking/block of [start, end) occupies the NIGHTS from start
// up to but not including end — so the end date itself is free for the
// next guest to check in (same convention as rangesOverlap in dates.ts).

export interface DateRange {
  start_date: string
  end_date: string
}

export interface Selection {
  checkIn: string
  checkOut: string
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return toISO(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/** Every occupied night across the given ranges. */
export function occupiedNights(ranges: DateRange[]): Set<string> {
  const nights = new Set<string>()
  for (const r of ranges) {
    for (let d = r.start_date; d < r.end_date; d = addDays(d, 1)) nights.add(d)
  }
  return nights
}

/** True if every night in [checkIn, checkOut) is free. */
export function rangeIsFree(checkIn: string, checkOut: string, occupied: Set<string>): boolean {
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    if (occupied.has(d)) return false
  }
  return true
}

/**
 * What a click on `clicked` does to the current selection. Returns the SAME
 * object when the click isn't allowed, so callers can use `next !== current`
 * to decide whether a day is clickable.
 */
export function nextSelection(
  current: Selection,
  clicked: string,
  occupied: Set<string>,
  today: string,
): Selection {
  if (clicked < today) return current

  const picking = current.checkIn && !current.checkOut
  if (picking && clicked > current.checkIn && rangeIsFree(current.checkIn, clicked, occupied)) {
    return { checkIn: current.checkIn, checkOut: clicked }
  }

  // Otherwise start a new selection here — but a night that's already
  // taken can't be a check-in.
  if (occupied.has(clicked)) return current
  if (picking && clicked === current.checkIn) return current
  return { checkIn: clicked, checkOut: '' }
}

/** Weeks (Monday first) for a month; null pads the leading/trailing days. */
export function monthGrid(year: number, monthIndex: number): (string | null)[][] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7 // Mon = 0
  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISO(year, monthIndex, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

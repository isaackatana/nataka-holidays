import { describe, expect, it } from 'vitest'
import { addDays, monthGrid, nextSelection, occupiedNights, rangeIsFree } from './availability'

const today = '2026-10-01'
const occupied = occupiedNights([{ start_date: '2026-10-10', end_date: '2026-10-13' }])
const none = { checkIn: '', checkOut: '' }

describe('occupiedNights', () => {
  it('covers nights from start up to, not including, end', () => {
    expect([...occupied]).toEqual(['2026-10-10', '2026-10-11', '2026-10-12'])
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('rangeIsFree', () => {
  it('lets a stay end on the day a block starts, and start on the day it ends', () => {
    expect(rangeIsFree('2026-10-08', '2026-10-10', occupied)).toBe(true)
    expect(rangeIsFree('2026-10-13', '2026-10-15', occupied)).toBe(true)
  })
  it('rejects a stay that includes a taken night', () => {
    expect(rangeIsFree('2026-10-09', '2026-10-11', occupied)).toBe(false)
    expect(rangeIsFree('2026-10-08', '2026-10-15', occupied)).toBe(false)
  })
})

describe('nextSelection', () => {
  it('first click sets check-in', () => {
    expect(nextSelection(none, '2026-10-05', occupied, today)).toEqual({ checkIn: '2026-10-05', checkOut: '' })
  })

  it('second later click sets check-out', () => {
    const sel = { checkIn: '2026-10-05', checkOut: '' }
    expect(nextSelection(sel, '2026-10-08', occupied, today)).toEqual({
      checkIn: '2026-10-05',
      checkOut: '2026-10-08',
    })
  })

  it('allows checking out on the first day of a block', () => {
    const sel = { checkIn: '2026-10-05', checkOut: '' }
    expect(nextSelection(sel, '2026-10-10', occupied, today).checkOut).toBe('2026-10-10')
  })

  it('refuses a check-out that would span a block, restarting if the day is free', () => {
    const sel = { checkIn: '2026-10-05', checkOut: '' }
    expect(nextSelection(sel, '2026-10-14', occupied, today)).toEqual({ checkIn: '2026-10-14', checkOut: '' })
  })

  it('ignores past days and taken nights', () => {
    expect(nextSelection(none, '2026-09-30', occupied, today)).toBe(none)
    expect(nextSelection(none, '2026-10-11', occupied, today)).toBe(none)
  })

  it('starts over when a full range is already chosen', () => {
    const sel = { checkIn: '2026-10-05', checkOut: '2026-10-08' }
    expect(nextSelection(sel, '2026-10-20', occupied, today)).toEqual({ checkIn: '2026-10-20', checkOut: '' })
  })

  it('a click earlier than the check-in moves the check-in', () => {
    const sel = { checkIn: '2026-10-05', checkOut: '' }
    expect(nextSelection(sel, '2026-10-03', occupied, today)).toEqual({ checkIn: '2026-10-03', checkOut: '' })
  })
})

describe('monthGrid', () => {
  it('starts weeks on Monday and pads to full weeks', () => {
    const weeks = monthGrid(2026, 9) // October 2026 starts on a Thursday
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks.flat().filter(Boolean)).toHaveLength(31)
  })
})

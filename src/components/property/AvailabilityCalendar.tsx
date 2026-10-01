import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  monthGrid,
  nextSelection,
  occupiedNights,
  type DateRange,
  type Selection,
} from '@/utils/availability'
import { todayISO } from '@/utils/dates'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

interface Props {
  blocks: DateRange[]
  value: Selection
  onChange: (next: Selection) => void
}

/** Click a check-in day, then a check-out day. Taken nights are struck
 * through; a stay can end on the morning a block starts. */
export function AvailabilityCalendar({ blocks, value, onChange }: Props) {
  const today = todayISO()
  const [year0, month0] = today.split('-').map(Number)
  const [view, setView] = useState({ year: year0, month: month0 - 1 })

  const occupied = useMemo(() => occupiedNights(blocks), [blocks])
  const weeks = useMemo(() => monthGrid(view.year, view.month), [view])

  const atCurrentMonth = view.year === year0 && view.month === month0 - 1
  const label = new Date(view.year, view.month, 1).toLocaleDateString('en-KE', {
    month: 'long',
    year: 'numeric',
  })

  function shift(delta: number) {
    const d = new Date(view.year, view.month + delta, 1)
    setView({ year: d.getFullYear(), month: d.getMonth() })
  }

  return (
    <div className="rounded-lg border border-sand-200 bg-sand-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={atCurrentMonth}
          aria-label="Previous month"
          className="rounded-full p-1.5 text-charcoal-600 hover:bg-sand-200 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium text-teal-900" aria-live="polite">
          {label}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="rounded-full p-1.5 text-charcoal-600 hover:bg-sand-200"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] uppercase tracking-wide text-charcoal-400">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {weeks.flat().map((day, i) => {
          if (!day) return <span key={`pad-${i}`} />

          const isPast = day < today
          const taken = occupied.has(day)
          const clickable = !isPast && nextSelection(value, day, occupied, today) !== value
          const isStart = day === value.checkIn
          const isEnd = day === value.checkOut
          const inRange = !!value.checkIn && !!value.checkOut && day > value.checkIn && day < value.checkOut

          let style = 'text-charcoal-800 hover:bg-teal-600/15'
          if (isStart || isEnd) style = 'bg-teal-900 text-sand-50'
          else if (inRange) style = 'bg-teal-600/15 text-teal-900'
          else if (taken) style = 'text-charcoal-300 line-through'
          else if (isPast) style = 'text-charcoal-300'

          return (
            <button
              key={day}
              type="button"
              disabled={!clickable && !isStart && !isEnd}
              onClick={() => onChange(nextSelection(value, day, occupied, today))}
              aria-label={`${new Date(`${day}T00:00:00`).toLocaleDateString('en-KE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}${taken ? ', unavailable' : ''}`}
              aria-pressed={isStart || isEnd}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-figures transition-colors disabled:cursor-not-allowed ${style}`}
            >
              {Number(day.slice(8))}
            </button>
          )
        })}
      </div>

      <p className="mt-2 text-[11px] text-charcoal-400">
        <span className="line-through">12</span> = unavailable. You can check out the day another stay begins.
      </p>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users } from 'lucide-react'

export function SearchBar() {
  const navigate = useNavigate()
  const [location, setLocation] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(2)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (location) params.set('location', location)
    if (checkIn) params.set('checkIn', checkIn)
    if (checkOut) params.set('checkOut', checkOut)
    if (guests) params.set('guests', String(guests))
    navigate(`/holiday-homes?${params.toString()}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 rounded-card bg-sand-50 p-4 shadow-card-hover md:flex-row md:items-end md:gap-2 md:p-3"
    >
      <label className="flex flex-1 flex-col gap-1 px-2">
        <span className="text-xs font-medium uppercase tracking-wide text-charcoal-500">Where</span>
        <input
          type="text"
          placeholder="Diani, Watamu, Malindi, Lamu..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="bg-transparent text-sm text-charcoal-900 outline-none placeholder:text-charcoal-300"
        />
      </label>

      <div className="hidden h-10 w-px bg-sand-200 md:block" />

      <label className="flex flex-1 flex-col gap-1 px-2">
        <span className="text-xs font-medium uppercase tracking-wide text-charcoal-500">Check-in</span>
        <input
          type="date"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          className="bg-transparent text-sm text-charcoal-900 outline-none"
        />
      </label>

      <div className="hidden h-10 w-px bg-sand-200 md:block" />

      <label className="flex flex-1 flex-col gap-1 px-2">
        <span className="text-xs font-medium uppercase tracking-wide text-charcoal-500">Check-out</span>
        <input
          type="date"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="bg-transparent text-sm text-charcoal-900 outline-none"
        />
      </label>

      <div className="hidden h-10 w-px bg-sand-200 md:block" />

      <label className="flex flex-1 flex-col gap-1 px-2">
        <span className="text-xs font-medium uppercase tracking-wide text-charcoal-500">Guests</span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-charcoal-500" />
          <input
            type="number"
            min={1}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="w-12 bg-transparent text-sm text-charcoal-900 outline-none"
          />
        </span>
      </label>

      <button
        type="submit"
        className="flex items-center justify-center gap-2 rounded-full bg-teal-900 px-6 py-3 text-sm font-medium text-sand-50 transition-colors hover:bg-teal-800 md:py-2.5"
      >
        <Search className="h-4 w-4" />
        Search
      </button>
    </form>
  )
}

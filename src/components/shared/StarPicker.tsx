import { Star } from 'lucide-react'

/** 1-5 star rating input (a radio group, so it works with keyboards and screen readers). */
export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          <Star
            className={`h-7 w-7 ${n <= value ? 'fill-gold-500 text-gold-500' : 'text-sand-300'}`}
          />
        </button>
      ))}
    </div>
  )
}

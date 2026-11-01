import { Heart } from 'lucide-react'

/** Save / unsave a shop product. `name` makes the label specific for screen readers. */
export function HeartButton({ saved, onToggle, name, className = '' }: { saved: boolean; onToggle: () => void; name: string; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from favorites` : `Save ${name} to favorites`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-sand-50/90 shadow-card transition-colors hover:bg-sand-50 ${className}`}
    >
      <Heart className={`h-4 w-4 ${saved ? 'fill-coral-500 text-coral-500' : 'text-charcoal-700'}`} aria-hidden="true" />
    </button>
  )
}

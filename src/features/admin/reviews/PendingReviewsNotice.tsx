import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { usePendingReviewCount } from '@/features/admin/reviews/queries'

/** Dashboard heads-up when guest reviews (or edited reviews/photos) await approval. */
export function PendingReviewsNotice() {
  const { data: count } = usePendingReviewCount()
  if (!count) return null

  return (
    <Link
      to="/admin/reviews"
      className="mt-6 flex items-center gap-3 rounded-card border border-gold-500/40 bg-gold-500/10 p-4 text-sm text-charcoal-900 hover:bg-gold-500/15"
    >
      <Star className="h-5 w-5 shrink-0 text-gold-600" aria-hidden="true" />
      <span>
        <strong>
          {count} review{count === 1 ? '' : 's'}
        </strong>{' '}
        waiting for your approval. Guests can't see {count === 1 ? 'it' : 'them'} until you approve.
      </span>
    </Link>
  )
}

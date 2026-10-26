import { Star } from 'lucide-react'
import type { ProductRating } from '@/services/shopReviews.service'

/** Small "★ 4.8 (12)" summary. Renders nothing for a product without approved reviews. */
export function RatingBadge({ rating }: { rating: ProductRating | undefined }) {
  if (!rating) return null
  return (
    <span
      className="inline-flex items-center gap-1 text-sm text-charcoal-500"
      aria-label={`Rated ${rating.average.toFixed(1)} out of 5 from ${rating.review_count} review${rating.review_count === 1 ? '' : 's'}`}
    >
      <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" aria-hidden="true" />
      <span className="font-figures font-medium text-teal-900">{rating.average.toFixed(1)}</span>
      <span>({rating.review_count})</span>
    </span>
  )
}

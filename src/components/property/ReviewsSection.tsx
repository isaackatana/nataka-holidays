import { Star } from 'lucide-react'
import { useApprovedReviews } from '@/features/reviews/queries'
import { getPublicImageUrl, getResizedImageUrl } from '@/utils/storage'
import { ratingBreakdown } from '@/utils/ratings'

export function ReviewsSection({ propertyId }: { propertyId: string }) {
  const { data: reviews, isLoading } = useApprovedReviews(propertyId)

  if (isLoading) return null
  if (!reviews || reviews.length === 0) {
    return (
      <p className="text-sm text-charcoal-500">
        No reviews yet — be the first to stay and share your experience.
      </p>
    )
  }

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-10">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 fill-gold-500 text-gold-500" />
          <span className="font-figures text-lg font-medium text-teal-900">{average.toFixed(1)}</span>
          <span className="text-sm text-charcoal-500">
            ({reviews.length} review{reviews.length === 1 ? '' : 's'})
          </span>
        </div>

        <ul className="flex w-full max-w-xs flex-col gap-1.5" aria-label="Rating breakdown">
          {ratingBreakdown(reviews.map((r) => r.rating)).map((bucket) => (
            <li
              key={bucket.stars}
              className="flex items-center gap-2 text-xs text-charcoal-600"
              aria-label={`${bucket.stars} star${bucket.stars === 1 ? '' : 's'}: ${bucket.count} review${bucket.count === 1 ? '' : 's'}`}
            >
              <span className="w-8 shrink-0 font-figures">{bucket.stars} ★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-200" aria-hidden="true">
                <div className="h-full rounded-full bg-gold-500" style={{ width: `${bucket.percent}%` }} />
              </div>
              <span className="w-6 shrink-0 text-right font-figures">{bucket.count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {reviews.map((review) => (
          <div key={review.id} className="flex flex-col gap-2 rounded-card bg-sand-100 p-5">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 ${
                    i < review.rating ? 'fill-gold-500 text-gold-500' : 'text-sand-300'
                  }`}
                />
              ))}
            </div>
            {review.comment && <p className="text-sm text-charcoal-700">{review.comment}</p>}
            {review.review_images?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {review.review_images.map((img) => (
                  <a
                    key={img.id}
                    href={getPublicImageUrl('review-images', img.storage_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open guest photo"
                  >
                    <img
                      src={getResizedImageUrl('review-images', img.storage_path, 400)}
                      alt={`Guest photo from ${review.profiles?.full_name ?? 'a guest'}'s stay`}
                      loading="lazy"
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
            <span className="font-mono text-xs text-charcoal-500">
              {review.profiles?.full_name ?? 'Guest'}
            </span>
            {review.owner_reply && (
              <div className="mt-2 rounded-lg border-l-2 border-teal-700 bg-sand-50 p-3">
                <p className="text-xs font-medium text-teal-900">Response from Nataka Holidays</p>
                <p className="mt-1 whitespace-pre-line text-sm text-charcoal-700">{review.owner_reply}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

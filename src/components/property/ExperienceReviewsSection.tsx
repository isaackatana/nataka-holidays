import { Star } from 'lucide-react'
import { useApprovedExperienceReviews } from '@/features/experienceReviews/queries'
import { ratingBreakdown } from '@/utils/ratings'

/** Approved guest reviews for one experience, with the business's replies. Hidden until there is one. */
export function ExperienceReviewsSection({ experienceId }: { experienceId: string }) {
  const { data: reviews } = useApprovedExperienceReviews(experienceId)
  if (!reviews || reviews.length === 0) return null

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length

  return (
    <section className="mt-10" aria-labelledby="experience-reviews-heading">
      <h2 id="experience-reviews-heading" className="font-display text-xl font-medium text-teal-900">
        Guest reviews
      </h2>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-10">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 fill-gold-500 text-gold-500" aria-hidden="true" />
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

      <ul className="mt-6 flex flex-col gap-5">
        {reviews.map((review) => (
          <li key={review.id} className="flex flex-col gap-2 border-t border-sand-200 pt-5 first:border-t-0 first:pt-0">
            <div className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  aria-hidden="true"
                  className={`h-4 w-4 ${n <= review.rating ? 'fill-gold-500 text-gold-500' : 'text-sand-300'}`}
                />
              ))}
            </div>
            {review.comment && <p className="text-sm text-charcoal-700">{review.comment}</p>}
            <span className="font-mono text-xs text-charcoal-500">{review.reviewer_name ?? 'Guest'}</span>
            {review.owner_reply && (
              <div className="mt-1 rounded-lg border-l-2 border-teal-700 bg-sand-50 p-3">
                <p className="text-xs font-medium text-teal-900">Response from Nataka Holidays</p>
                <p className="mt-1 whitespace-pre-line text-sm text-charcoal-700">{review.owner_reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { useFeaturedReviews } from '@/features/reviews/queries'

/**
 * Home page "What guests are saying": real approved reviews (4-5 stars with a
 * written comment). With none yet, or if they can't load, the whole section is
 * left out rather than showing placeholder text.
 */
export function GuestStories() {
  const { data: reviews } = useFeaturedReviews()
  if (!reviews || reviews.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-20">
      <SectionHeading eyebrow="Guest stories" title="What guests are saying" align="center" />
      <ul className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <li key={review.id} className="flex flex-col gap-4 rounded-card bg-sand-100 p-6">
            <div className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  aria-hidden="true"
                  className={`h-4 w-4 ${n <= review.rating ? 'fill-gold-500 text-gold-500' : 'text-sand-300'}`}
                />
              ))}
            </div>
            <p className="line-clamp-6 font-display text-base italic text-charcoal-700">
              “{review.comment}”
            </p>
            <div className="mt-auto text-sm">
              <p className="font-medium text-teal-900">{review.reviewer_name ?? 'Guest'}</p>
              {review.properties && (
                <Link to={`/stays/${review.properties.slug}`} className="text-teal-800 hover:underline">
                  {review.properties.title}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

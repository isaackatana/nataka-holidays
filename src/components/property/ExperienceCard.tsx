import { type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Briefcase, Check, Star } from 'lucide-react'
import type { Experience } from '@/types/domain'
import { getImageSrcSet, getResizedImageUrl } from '@/utils/storage'
import { formatKES } from '@/utils/currency'
import { categoryLabel, priceBasisLabel } from '@/data/experienceOptions'
import { useTripCart } from '@/features/tripCart/TripCartContext'
import { useExperienceRatings } from '@/features/experienceReviews/queries'

export function ExperienceCard({ experience }: { experience: Experience }) {
  const primaryImage = experience.experience_images?.[0]
  const imagePath = primaryImage?.storage_path ?? null
  const { addExperience, removeExperience, isExperienceInCart } = useTripCart()
  const inTrip = isExperienceInCart(experience.id)
  const { data: ratings } = useExperienceRatings()
  const rating = ratings?.[experience.id]

  function handleToggleTrip(e: MouseEvent) {
    e.preventDefault()
    if (inTrip) {
      removeExperience(experience.id)
    } else {
      addExperience({
        id: experience.id,
        title: experience.title,
        slug: experience.slug,
        price: experience.price,
      })
    }
  }

  return (
    <Link
      to={`/experiences/${experience.slug}`}
      className="group flex flex-col overflow-hidden rounded-card bg-sand-50 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-teal-900">
        {imagePath ? (
          <img
            src={getResizedImageUrl('experience-images', imagePath, 800)}
            srcSet={getImageSrcSet('experience-images', imagePath, [400, 800, 1200])}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            alt={experience.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-800 to-teal-950 text-sand-200">
            <span className="font-display text-lg">{experience.title}</span>
          </div>
        )}

        <button
          onClick={handleToggleTrip}
          aria-label={inTrip ? 'Remove from trip' : 'Add to trip'}
          aria-pressed={inTrip}
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-transform hover:scale-110 ${
            inTrip ? 'bg-teal-800 text-sand-50' : 'bg-sand-50/90 text-charcoal-700'
          }`}
        >
          {inTrip ? <Check className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        {categoryLabel(experience.category) && (
          <span className="text-xs font-medium uppercase tracking-wide text-gold-600">
            {categoryLabel(experience.category)}
          </span>
        )}
        <h3 className="font-display text-base font-medium text-teal-900">{experience.title}</h3>
        <div className="flex items-center gap-4 text-sm text-charcoal-500">
          {experience.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {experience.duration}
            </span>
          )}
          {rating && (
            <span
              className="flex items-center gap-1"
              aria-label={`Rated ${rating.average.toFixed(1)} out of 5 from ${rating.review_count} review${rating.review_count === 1 ? '' : 's'}`}
            >
              <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" aria-hidden="true" />
              <span className="font-figures font-medium text-teal-900">{rating.average.toFixed(1)}</span>
              <span>({rating.review_count})</span>
            </span>
          )}
          {experience.price !== null && (
            <span className="font-figures">
              {formatKES(experience.price)}
              {priceBasisLabel(experience.price_type) && (
                <span className="font-sans text-xs text-charcoal-500"> {priceBasisLabel(experience.price_type)}</span>
              )}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

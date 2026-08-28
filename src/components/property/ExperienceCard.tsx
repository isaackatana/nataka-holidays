import { type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Briefcase, Check } from 'lucide-react'
import type { Experience } from '@/types/domain'
import { getPublicImageUrl } from '@/utils/storage'
import { formatKES } from '@/utils/currency'
import { useTripCart } from '@/features/tripCart/TripCartContext'

export function ExperienceCard({ experience }: { experience: Experience }) {
  const primaryImage = experience.experience_images?.[0]
  const imageUrl = primaryImage ? getPublicImageUrl('experience-images', primaryImage.storage_path) : null
  const { addExperience, removeExperience, isExperienceInCart } = useTripCart()
  const inTrip = isExperienceInCart(experience.id)

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
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={experience.title}
            loading="lazy"
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
        <h3 className="font-display text-base font-medium text-teal-900">{experience.title}</h3>
        <div className="flex items-center gap-4 text-sm text-charcoal-500">
          {experience.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {experience.duration}
            </span>
          )}
          {experience.price !== null && (
            <span className="font-figures">{formatKES(experience.price)}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

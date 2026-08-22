import { Link } from 'react-router-dom'
import { Heart, BedDouble, Users, MapPin } from 'lucide-react'
import type { Property } from '@/types/domain'
import { getPrimaryPropertyImageUrl } from '@/utils/storage'
import { formatKES } from '@/utils/currency'

interface PropertyCardProps {
  property: Property
  isFavorited?: boolean
  onToggleFavorite?: (propertyId: string) => void
}

export function PropertyCard({ property, isFavorited, onToggleFavorite }: PropertyCardProps) {
  const imageUrl = getPrimaryPropertyImageUrl(property.property_images)

  return (
    <Link
      to={`/stays/${property.slug}`}
      className="group flex flex-col overflow-hidden rounded-card bg-sand-50 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sand-200">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={property.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sand-400">
            <span className="font-mono text-xs">No photo yet</span>
          </div>
        )}

        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.preventDefault()
              onToggleFavorite(property.id)
            }}
            aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-sand-50/90 backdrop-blur transition-transform hover:scale-110"
          >
            <Heart
              className={`h-4 w-4 ${isFavorited ? 'fill-coral-500 text-coral-500' : 'text-charcoal-700'}`}
            />
          </button>
        )}

        {property.is_featured && (
          <span className="absolute left-3 top-3 rounded-pill bg-gold-600 px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-sand-50">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-medium leading-snug text-teal-900">
            {property.title}
          </h3>
        </div>

        <p className="flex items-center gap-1 text-sm text-charcoal-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {property.location}
        </p>

        <div className="mt-1 flex items-center gap-4 text-sm text-charcoal-500">
          <span className="flex items-center gap-1">
            <BedDouble className="h-4 w-4" />
            {property.bedrooms} bed
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {property.max_guests} guests
          </span>
        </div>

        <div className="mt-auto flex items-baseline gap-1 pt-2">
          <span className="font-figures text-lg font-medium text-teal-900">
            {formatKES(property.price_per_night)}
          </span>
          <span className="text-sm text-charcoal-500">/ night</span>
        </div>
      </div>
    </Link>
  )
}

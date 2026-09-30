import { Check } from 'lucide-react'
import type { Amenity } from '@/types/domain'
import { AMENITY_ICON_MAP } from './amenityIcons'

export function AmenitiesList({ amenities }: { amenities: Amenity[] }) {
  if (amenities.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {amenities.map((amenity) => {
        // Fall back to a plain checkmark if the stored icon name doesn't
        // match anything in AMENITY_ICON_MAP — the admin form constrains
        // icon choice to this exact set, but this stays defensive in case
        // an amenity was created before an icon existed here.
        const IconComponent = (amenity.icon && AMENITY_ICON_MAP[amenity.icon]) || Check
        return (
          <div key={amenity.id} className="flex items-center gap-3 text-charcoal-700">
            <IconComponent className="h-5 w-5 shrink-0 text-teal-700" />
            <span className="text-sm">{amenity.name}</span>
          </div>
        )
      })}
    </div>
  )
}

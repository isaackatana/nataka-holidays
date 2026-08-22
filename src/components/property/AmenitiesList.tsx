import {
  Wifi,
  Waves,
  Snowflake,
  Palmtree,
  Car,
  Utensils,
  Zap,
  Sparkles,
  Shield,
  Flower2,
  Tv,
  WashingMachine,
  Wind,
  Flame,
  Bath,
  BedDouble,
  Dumbbell,
  Baby,
  PawPrint,
  Coffee,
  Refrigerator,
  Sun,
  Umbrella,
  Waves as Pool,
  DoorOpen,
  Lock,
  Check,
  type LucideIcon,
} from 'lucide-react'
import type { Amenity } from '@/types/domain'

// A bounded, explicit map rather than `import * as Icons from 'lucide-react'`.
// The wildcard-namespace + dynamic-property-access pattern (`Icons[name]`)
// can't be tree-shaken by Rollup, since the bundler can't statically prove
// which icons are actually used — it pulls in the ENTIRE icon library
// (measured at over 500KB on its own) just to maybe use a handful of them.
// Exported so the admin Amenities form (pages/admin/Amenities.tsx) offers
// exactly this set as choices, rather than free-text that could reference
// an icon name not in this map — extend it here if a new icon is needed,
// and it becomes available in both places at once.
export const AMENITY_ICON_MAP: Record<string, LucideIcon> = {
  wifi: Wifi,
  waves: Waves,
  pool: Pool,
  snowflake: Snowflake,
  palmtree: Palmtree,
  car: Car,
  utensils: Utensils,
  zap: Zap,
  sparkles: Sparkles,
  shield: Shield,
  'flower-2': Flower2,
  tv: Tv,
  'washing-machine': WashingMachine,
  wind: Wind,
  flame: Flame,
  bath: Bath,
  'bed-double': BedDouble,
  dumbbell: Dumbbell,
  baby: Baby,
  'paw-print': PawPrint,
  coffee: Coffee,
  refrigerator: Refrigerator,
  sun: Sun,
  umbrella: Umbrella,
  'door-open': DoorOpen,
  lock: Lock,
}

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

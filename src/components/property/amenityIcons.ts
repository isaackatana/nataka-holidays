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
  type LucideIcon,
} from 'lucide-react'

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

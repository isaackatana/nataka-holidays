/**
 * Mirrors the `profiles` table from supabase/migrations/0001_initial_schema.sql.
 * Once a live Supabase project exists and `src/types/database.types.ts` is
 * regenerated (see supabase/README.md §4), this can be replaced with:
 *   export type Profile = Database['public']['Tables']['profiles']['Row']
 */
export type UserRole = 'customer' | 'admin'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export type PropertyType = 'villa' | 'apartment' | 'cottage' | 'beach_house' | 'other'
export type BookingStatus = 'pending' | 'contacted' | 'confirmed' | 'cancelled' | 'completed'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface PropertyImage {
  id: string
  property_id: string
  storage_path: string
  sort_order: number
  is_primary: boolean
}

export interface Amenity {
  id: string
  name: string
  icon: string | null
}

export interface Property {
  id: string
  title: string
  slug: string
  description: string
  location: string
  latitude: number | null
  longitude: number | null
  property_type: PropertyType
  price_per_night: number
  cleaning_fee: number
  max_guests: number
  bedrooms: number
  bathrooms: number
  house_rules: string | null
  check_in_time: string
  check_out_time: string
  video_url: string | null
  is_featured: boolean
  is_published: boolean
  created_at: string
  updated_at: string
  // Joined data — present when fetched via the properties service, not a
  // raw column on the `properties` table itself.
  property_images?: PropertyImage[]
  amenities?: Amenity[]
}

export interface AdminPropertyDetail extends Property {
  amenityIds: string[]
}

export interface Experience {
  id: string
  title: string
  slug: string
  description: string
  location: string | null
  price: number | null
  duration: string | null
  video_url: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  experience_images?: { id: string; storage_path: string; sort_order: number }[]
}

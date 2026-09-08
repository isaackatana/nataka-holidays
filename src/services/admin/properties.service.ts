import { supabase } from '@/lib/supabase'
import type { Property, AdminPropertyDetail } from '@/types/domain'

const PROPERTY_SELECT = `
  id, title, slug, description, location, latitude, longitude,
  property_type, price_per_night, cleaning_fee, max_guests, bedrooms,
  bathrooms, house_rules, check_in_time, check_out_time, video_url, is_featured,
  is_published, created_at, updated_at,
  property_images ( id, property_id, storage_path, sort_order, is_primary )
`

/** Every property, published or not — relies on the admin RLS policy
 * (`properties_select_published_or_admin`) rather than filtering here. */
export async function getAllPropertiesForAdmin(): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select(PROPERTY_SELECT)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Property[]
}

export async function getPropertyByIdForAdmin(id: string): Promise<AdminPropertyDetail | null> {
  const { data, error } = await supabase
    .from('properties')
    .select(`${PROPERTY_SELECT}, property_amenities ( amenity_id )`)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  const raw = data as unknown as Property & { property_amenities?: { amenity_id: string }[] }
  return { ...raw, amenityIds: (raw.property_amenities ?? []).map((pa) => pa.amenity_id) }
}

export interface PropertyFormInput {
  title: string
  slug: string
  description: string
  location: string
  propertyType: string
  pricePerNight: number
  cleaningFee: number
  maxGuests: number
  bedrooms: number
  bathrooms: number
  houseRules?: string
  checkInTime: string
  checkOutTime: string
  videoUrl?: string
  latitude?: number
  longitude?: number
  isFeatured: boolean
  isPublished: boolean
  amenityIds: string[]
}

function toRow(input: PropertyFormInput) {
  return {
    title: input.title,
    slug: input.slug,
    description: input.description,
    location: input.location,
    property_type: input.propertyType,
    price_per_night: input.pricePerNight,
    cleaning_fee: input.cleaningFee,
    max_guests: input.maxGuests,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    house_rules: input.houseRules || null,
    check_in_time: input.checkInTime,
    check_out_time: input.checkOutTime,
    video_url: input.videoUrl || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    is_featured: input.isFeatured,
    is_published: input.isPublished,
  }
}

/** Replaces every property_amenities row for a property with the given
 * set — simpler and safer than diffing add/remove, and amenity lists are
 * short enough that a full delete+insert is cheap. */
async function syncPropertyAmenities(propertyId: string, amenityIds: string[]) {
  const { error: deleteError } = await supabase
    .from('property_amenities')
    .delete()
    .eq('property_id', propertyId)
  if (deleteError) throw deleteError

  if (amenityIds.length === 0) return

  const { error: insertError } = await supabase
    .from('property_amenities')
    .insert(amenityIds.map((amenityId) => ({ property_id: propertyId, amenity_id: amenityId })) as never)
  if (insertError) throw insertError
}

export async function createProperty(input: PropertyFormInput): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .insert(toRow(input) as never)
    .select('*')
    .single()

  if (error) throw error
  const property = data as unknown as Property
  await syncPropertyAmenities(property.id, input.amenityIds)
  return property
}

export async function updateProperty(id: string, input: PropertyFormInput): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .update(toRow(input) as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  await syncPropertyAmenities(id, input.amenityIds)
  return data as unknown as Property
}

export async function deleteProperty(id: string): Promise<void> {
  // property_images, property_amenities, favorites, and reviews all cascade
  // via ON DELETE CASCADE (see 0001_initial_schema.sql); bookings keep a
  // dangling property_id reference by design so enquiry history survives
  // a delisted property (handled as "Deleted property" in the UI).
  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) throw error
}

export async function togglePublished(id: string, isPublished: boolean): Promise<void> {
  const { error } = await supabase.from('properties').update({ is_published: isPublished } as never).eq('id', id)
  if (error) throw error
}

export async function toggleFeatured(id: string, isFeatured: boolean): Promise<void> {
  const { error } = await supabase.from('properties').update({ is_featured: isFeatured } as never).eq('id', id)
  if (error) throw error
}

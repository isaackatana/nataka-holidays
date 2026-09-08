import { supabase } from '@/lib/supabase'
import type { Property } from '@/types/domain'

const PROPERTY_SELECT = `
  id, title, slug, description, location, latitude, longitude,
  property_type, price_per_night, cleaning_fee, max_guests, bedrooms,
  bathrooms, house_rules, check_in_time, check_out_time, video_url, is_featured,
  is_published, created_at, updated_at,
  property_images ( id, property_id, storage_path, sort_order, is_primary )
`

export async function getFeaturedProperties(limit = 6): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select(PROPERTY_SELECT)
    .eq('is_published', true)
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as unknown as Property[]
}

export interface PropertyFilters {
  location?: string
  propertyType?: string
  minPrice?: number
  maxPrice?: number
  minGuests?: number
  minBedrooms?: number
  /** Matches properties with ANY of the given amenity ids (not all —
   * requiring every selected amenity tends to zero out results fast on a
   * small catalog; ANY-match reads more like "has some of what I want"). */
  amenityIds?: string[]
  /** ISO date strings (yyyy-mm-dd). When both are set, properties with an
   * overlapping booking_blocks row for that range are excluded. */
  checkIn?: string
  checkOut?: string
  sort?: 'featured' | 'price_asc' | 'price_desc' | 'newest'
}

export async function getPublishedProperties(filters: PropertyFilters = {}): Promise<Property[]> {
  let query = supabase.from('properties').select(PROPERTY_SELECT).eq('is_published', true)

  if (filters.location) query = query.ilike('location', `%${filters.location}%`)
  if (filters.propertyType) query = query.eq('property_type', filters.propertyType)
  if (filters.minPrice !== undefined) query = query.gte('price_per_night', filters.minPrice)
  if (filters.maxPrice !== undefined) query = query.lte('price_per_night', filters.maxPrice)
  if (filters.minGuests !== undefined) query = query.gte('max_guests', filters.minGuests)
  if (filters.minBedrooms !== undefined) query = query.gte('bedrooms', filters.minBedrooms)

  if (filters.amenityIds && filters.amenityIds.length > 0) {
    const { data: matches, error: amenitiesError } = await supabase
      .from('property_amenities')
      .select('property_id')
      .in('amenity_id', filters.amenityIds)

    if (amenitiesError) throw amenitiesError
    const matchingIds = [
      ...new Set(((matches ?? []) as unknown as { property_id: string }[]).map((m) => m.property_id)),
    ]
    // No matches at all -> short-circuit to an empty result rather than
    // sending `.in('id', [])`, which Postgres/PostgREST can interpret
    // inconsistently across versions.
    if (matchingIds.length === 0) return []
    query = query.in('id', matchingIds)
  }

  switch (filters.sort) {
    case 'price_asc':
      query = query.order('price_per_night', { ascending: true })
      break
    case 'price_desc':
      query = query.order('price_per_night', { ascending: false })
      break
    case 'newest':
      query = query.order('created_at', { ascending: false })
      break
    default:
      query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false })
  }

  const { data, error } = await query
  if (error) throw error
  let properties = (data ?? []) as unknown as Property[]

  // Availability filtering happens as a second pass rather than a single
  // SQL query: Supabase's query builder doesn't have a clean way to
  // express "exclude rows with an overlapping row in another table"
  // (a NOT EXISTS correlated subquery) without a Postgres RPC function.
  // For the property counts this app deals with, fetching blocks for the
  // already-filtered candidate set and excluding client-side is simpler
  // than shipping a bespoke RPC for it.
  if (filters.checkIn && filters.checkOut && properties.length > 0) {
    const propertyIds = properties.map((p) => p.id)
    const { data: blocks, error: blocksError } = await supabase
      .from('booking_blocks')
      .select('property_id, start_date, end_date')
      .in('property_id', propertyIds)
      .lt('start_date', filters.checkOut)
      .gt('end_date', filters.checkIn)

    if (blocksError) throw blocksError
    const blockedPropertyIds = new Set(
      ((blocks ?? []) as unknown as { property_id: string }[]).map((b) => b.property_id),
    )
    properties = properties.filter((p) => !blockedPropertyIds.has(p.id))
  }

  return properties
}

export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select(
      `${PROPERTY_SELECT}, property_amenities ( amenities ( id, name, icon ) )`,
    )
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  // property_amenities comes back as [{ amenities: {id,name,icon} }, ...]
  // via the join — flatten it into Property.amenities so components don't
  // need to know about the join table shape.
  const raw = data as unknown as Property & {
    property_amenities?: { amenities: { id: string; name: string; icon: string | null } }[]
  }
  const amenities = (raw.property_amenities ?? []).map((pa) => pa.amenities).filter(Boolean)
  return { ...raw, amenities }
}

export async function getRelatedProperties(property: Property, limit = 3): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select(PROPERTY_SELECT)
    .eq('is_published', true)
    .eq('location', property.location)
    .neq('id', property.id)
    .limit(limit)

  if (error) throw error
  const results = (data ?? []) as unknown as Property[]

  // Same location came up short (small catalog) — widen to same property
  // type instead of showing nothing.
  if (results.length < limit) {
    const { data: typeMatches, error: typeError } = await supabase
      .from('properties')
      .select(PROPERTY_SELECT)
      .eq('is_published', true)
      .eq('property_type', property.property_type)
      .neq('id', property.id)
      .limit(limit)

    if (typeError) throw typeError
    const seen = new Set(results.map((p) => p.id))
    for (const p of (typeMatches ?? []) as unknown as Property[]) {
      if (!seen.has(p.id) && results.length < limit) {
        results.push(p)
        seen.add(p.id)
      }
    }
  }

  return results
}

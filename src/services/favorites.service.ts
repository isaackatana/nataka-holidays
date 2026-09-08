import { supabase } from '@/lib/supabase'
import type { Property } from '@/types/domain'

const PROPERTY_SELECT = `
  id, title, slug, description, location, latitude, longitude,
  property_type, price_per_night, cleaning_fee, max_guests, bedrooms,
  bathrooms, house_rules, check_in_time, check_out_time, video_url, is_featured,
  is_published, created_at, updated_at,
  property_images ( id, property_id, storage_path, sort_order, is_primary )
`

/** Just the ids — cheap to fetch on every page so PropertyCard grids
 * everywhere can show the correct filled/outline heart state. */
export async function getFavoriteIds(customerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('property_id')
    .eq('customer_id', customerId)

  if (error) throw error
  return ((data ?? []) as unknown as { property_id: string }[]).map((f) => f.property_id)
}

/** Full property rows for the Favorites page itself. */
export async function getFavoriteProperties(customerId: string): Promise<Property[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select(`property_id, properties ( ${PROPERTY_SELECT} )`)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as unknown as { properties: Property }[])
    .map((row) => row.properties)
    .filter(Boolean)
}

export async function addFavorite(customerId: string, propertyId: string): Promise<void> {
  const { error } = await supabase
    .from('favorites')
    .insert({ customer_id: customerId, property_id: propertyId } as never)
  // Re-adding an already-favorited property hits the composite primary key
  // and raises a unique-violation — treat that as a harmless no-op rather
  // than surfacing an error, since the end state the user wanted is the
  // same either way.
  if (error && error.code !== '23505') throw error
}

export async function removeFavorite(customerId: string, propertyId: string): Promise<void> {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('customer_id', customerId)
    .eq('property_id', propertyId)

  if (error) throw error
}

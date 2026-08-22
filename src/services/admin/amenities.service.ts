import { supabase } from '@/lib/supabase'
import type { Amenity } from '@/types/domain'

export async function getAllAmenitiesAdmin(): Promise<Amenity[]> {
  const { data, error } = await supabase.from('amenities').select('id, name, icon').order('name')
  if (error) throw error
  return (data ?? []) as unknown as Amenity[]
}

export interface AmenityInput {
  name: string
  icon: string | null
}

export async function createAmenity(input: AmenityInput): Promise<Amenity> {
  const { data, error } = await supabase.from('amenities').insert(input as never).select('*').single()
  if (error) throw error
  return data as unknown as Amenity
}

export async function updateAmenity(id: string, input: AmenityInput): Promise<Amenity> {
  const { data, error } = await supabase
    .from('amenities')
    .update(input as never)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as unknown as Amenity
}

export async function deleteAmenity(id: string): Promise<void> {
  // property_amenities.amenity_id has ON DELETE CASCADE
  // (0001_initial_schema.sql) — deleting an amenity here also removes it
  // from every property that had it assigned, silently and permanently.
  // The confirm dialog in the UI spells this out rather than assuming
  // the admin remembers this cascade exists.
  const { error } = await supabase.from('amenities').delete().eq('id', id)
  if (error) throw error
}

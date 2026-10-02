import { supabase } from '@/lib/supabase'
import { prepareImageForUpload } from '@/utils/image'
import type { PropertyImage } from '@/types/domain'

const BUCKET = 'property-images'

/** Sanitizes a filename for use in a storage path — Supabase Storage
 * rejects some characters that filenames can otherwise contain. */
function sanitizeFilename(filename: string): string {
  return filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
}

export async function uploadPropertyImage(
  propertyId: string,
  file: File,
  currentImageCount: number,
): Promise<PropertyImage> {
  // Shrink before upload: a phone original can be 5 MB+, which makes every
  // listing slow to load on mobile data.
  const optimized = await prepareImageForUpload(file)
  const path = `${propertyId}/${Date.now()}-${sanitizeFilename(optimized.name)}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, optimized, {
    // Paths are unique per upload (timestamped), so a file never changes:
    // let browsers and the CDN keep it for a year.
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('property_images')
    .insert({
      property_id: propertyId,
      storage_path: path,
      sort_order: currentImageCount,
      // The very first image uploaded for a property becomes primary
      // automatically — otherwise a new listing would have no primary
      // image at all until an admin remembers to set one.
      is_primary: currentImageCount === 0,
    } as never)
    .select('*')
    .single()

  if (insertError) {
    // Roll back the storage upload if the DB insert failed, so we don't
    // leave an orphaned file with no row pointing at it.
    await supabase.storage.from(BUCKET).remove([path])
    throw insertError
  }

  return data as unknown as PropertyImage
}

export async function deletePropertyImage(image: PropertyImage): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([image.storage_path])
  if (storageError) throw storageError

  const { error: deleteError } = await supabase.from('property_images').delete().eq('id', image.id)
  if (deleteError) throw deleteError

  // If the deleted image was primary, promote whichever remains first in
  // sort order — a property should never be left with zero primary
  // images as long as it has at least one photo.
  if (image.is_primary) {
    const { data: remaining, error: fetchError } = await supabase
      .from('property_images')
      .select('id')
      .eq('property_id', image.property_id)
      .order('sort_order', { ascending: true })
      .limit(1)

    if (fetchError) throw fetchError
    const next = (remaining ?? [])[0] as { id: string } | undefined
    if (next) {
      const { error: promoteError } = await supabase
        .from('property_images')
        .update({ is_primary: true } as never)
        .eq('id', next.id)
      if (promoteError) throw promoteError
    }
  }
}

export async function setPrimaryImage(propertyId: string, imageId: string): Promise<void> {
  // Not wrapped in a single DB transaction (the JS client can't start one
  // directly) — two sequential updates scoped to a single admin's own
  // action on their own property. The unique partial index on
  // `is_primary = true` per property (0001_initial_schema.sql) means a
  // failure between these two steps can't leave two primaries, only zero
  // momentarily, which self-heals the next time this function succeeds.
  const { error: unsetError } = await supabase
    .from('property_images')
    .update({ is_primary: false } as never)
    .eq('property_id', propertyId)
    .eq('is_primary', true)
  if (unsetError) throw unsetError

  const { error: setError } = await supabase
    .from('property_images')
    .update({ is_primary: true } as never)
    .eq('id', imageId)
  if (setError) throw setError
}

export async function reorderPropertyImages(orderedImageIds: string[]): Promise<void> {
  await Promise.all(
    orderedImageIds.map((id, index) =>
      supabase
        .from('property_images')
        .update({ sort_order: index } as never)
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error
        }),
    ),
  )
}

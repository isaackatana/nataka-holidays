import { supabase } from '@/lib/supabase'
import { prepareImageForUpload } from '@/utils/image'
import type { PropertyImage } from '@/types/domain'

const BUCKET = 'experience-images'

export type ExperienceImage = Pick<PropertyImage, 'id' | 'storage_path' | 'sort_order'>

function sanitizeFilename(filename: string): string {
  return filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
}

export async function uploadExperienceImage(
  experienceId: string,
  file: File,
  currentImageCount: number,
): Promise<ExperienceImage> {
  // Shrink before upload: a phone original can be 5 MB+, which makes every
  // listing slow to load on mobile data.
  const optimized = await prepareImageForUpload(file)
  const path = `${experienceId}/${Date.now()}-${sanitizeFilename(optimized.name)}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, optimized, {
    // Paths are unique per upload (timestamped), so a file never changes:
    // let browsers and the CDN keep it for a year.
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('experience_images')
    .insert({
      experience_id: experienceId,
      storage_path: path,
      sort_order: currentImageCount,
    } as never)
    .select('*')
    .single()

  if (insertError) {
    // Same rollback reasoning as uploadPropertyImage — don't leave an
    // orphaned Storage object with no DB row pointing at it.
    await supabase.storage.from(BUCKET).remove([path])
    throw insertError
  }

  return data as unknown as ExperienceImage
}

export async function deleteExperienceImage(image: ExperienceImage): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([image.storage_path])
  if (storageError) throw storageError

  const { error: deleteError } = await supabase.from('experience_images').delete().eq('id', image.id)
  if (deleteError) throw deleteError
  // No primary-image promotion needed here (unlike deletePropertyImage) —
  // there's no is_primary column; whichever image now has the lowest
  // sort_order is automatically the de facto "first" image.
}

export async function reorderExperienceImages(orderedImageIds: string[]): Promise<void> {
  await Promise.all(
    orderedImageIds.map((id, index) =>
      supabase
        .from('experience_images')
        .update({ sort_order: index } as never)
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error
        }),
    ),
  )
}

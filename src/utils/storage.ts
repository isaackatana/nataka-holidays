import { supabase } from '@/lib/supabase'

/**
 * Both image buckets (property-images, experience-images) are public
 * buckets (see supabase/migrations/0004_storage.sql), so this returns a
 * plain public URL rather than a signed one.
 */
export function getPublicImageUrl(
  bucket: 'property-images' | 'experience-images',
  storagePath: string,
): string {
  return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
}

export function getPrimaryPropertyImageUrl(
  images: { storage_path: string; is_primary: boolean }[] | undefined,
): string | null {
  if (!images || images.length === 0) return null
  const primary = images.find((img) => img.is_primary) ?? images[0]
  return getPublicImageUrl('property-images', primary.storage_path)
}

/**
 * Supabase can resize images on the fly, but only on paid plans (Pro and
 * up). Set VITE_IMAGE_TRANSFORMS=true once you're on one: cards and galleries
 * then request right-sized copies, which also helps photos uploaded before
 * upload-time resizing existed. Off by default so nothing breaks on the free plan.
 */
const TRANSFORMS_ENABLED = import.meta.env.VITE_IMAGE_TRANSFORMS === 'true'

/** A copy of the image at roughly `width` pixels wide (or the original when transforms are off). */
export function getResizedImageUrl(
  bucket: 'property-images' | 'experience-images',
  storagePath: string,
  width: number,
): string {
  if (!TRANSFORMS_ENABLED) return getPublicImageUrl(bucket, storagePath)
  return supabase.storage.from(bucket).getPublicUrl(storagePath, { transform: { width, quality: 75 } }).data
    .publicUrl
}

/** `srcset` value for responsive loading, or undefined when transforms are off. */
export function getImageSrcSet(
  bucket: 'property-images' | 'experience-images',
  storagePath: string,
  widths: number[],
): string | undefined {
  if (!TRANSFORMS_ENABLED) return undefined
  return widths.map((w) => `${getResizedImageUrl(bucket, storagePath, w)} ${w}w`).join(', ')
}

export function getPrimaryPropertyImagePath(
  images: { storage_path: string; is_primary: boolean }[] | undefined,
): string | null {
  if (!images || images.length === 0) return null
  return (images.find((img) => img.is_primary) ?? images[0]).storage_path
}

/** Longest side, in pixels, of a photo as stored. Big enough for a full-width
 * gallery on a large desktop screen; far smaller than a phone camera original. */
export const MAX_IMAGE_SIDE = 1920

/** Scales (width, height) down so the longest side is at most `max`,
 * keeping the aspect ratio. Never scales up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Swaps a filename's extension, e.g. ('IMG_1.JPG', 'webp') -> 'IMG_1.webp'. */
export function withExtension(filename: string, extension: string): string {
  const dot = filename.lastIndexOf('.')
  return `${dot > 0 ? filename.slice(0, dot) : filename}.${extension}`
}

/**
 * Shrinks a photo in the browser before upload. Phone photos are commonly
 * 3-8 MB; on mobile data that makes every listing slow for every visitor.
 * This resizes to MAX_IMAGE_SIDE and re-encodes as WebP (smaller than JPEG at
 * the same quality), respecting the camera's rotation (EXIF).
 *
 * Fails safe: if anything isn't supported or goes wrong, or the result
 * isn't actually smaller, the original file is uploaded unchanged.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_SIDE)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file
    return new File([blob], withExtension(file.name, 'webp'), { type: 'image/webp' })
  } catch {
    return file
  }
}

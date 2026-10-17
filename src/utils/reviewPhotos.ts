export const MAX_REVIEW_PHOTOS = 3
/** Largest photo accepted before shrinking. Phone originals are often 5-10 MB. */
export const MAX_REVIEW_PHOTO_BYTES = 15 * 1024 * 1024
export const ALLOWED_REVIEW_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface PhotoSelection {
  accepted: File[]
  /** A short message for the guest, or null when everything was accepted. */
  problem: string | null
}

/**
 * Filters files a guest picked: only JPEG/PNG/WebP, not huge, and no more than
 * the 3-photo limit once photos already attached or queued are counted.
 */
export function selectReviewPhotos(existingCount: number, picked: File[]): PhotoSelection {
  const room = Math.max(MAX_REVIEW_PHOTOS - existingCount, 0)
  const accepted: File[] = []
  let problem: string | null = null

  for (const file of picked) {
    if (!ALLOWED_REVIEW_PHOTO_TYPES.includes(file.type)) {
      problem = 'Only JPEG, PNG or WebP photos can be added.'
    } else if (file.size > MAX_REVIEW_PHOTO_BYTES) {
      problem = 'That photo is too large. Please choose one under 15 MB.'
    } else if (accepted.length >= room) {
      problem = `You can add up to ${MAX_REVIEW_PHOTOS} photos.`
    } else {
      accepted.push(file)
    }
  }
  return { accepted, problem }
}

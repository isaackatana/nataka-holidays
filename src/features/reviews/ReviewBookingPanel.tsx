import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Star, ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/TextareaField'
import { useSubmitReview, useUpdateMyReview } from '@/features/reviews/queries'
import {
  REVIEW_COMMENT_MAX,
  deleteReviewImage,
  uploadReviewImage,
  type MyReview,
  type ReviewImage,
} from '@/services/reviews.service'
import { notifyBooking } from '@/services/notify.service'
import { getResizedImageUrl } from '@/utils/storage'
import { MAX_REVIEW_PHOTOS, selectReviewPhotos } from '@/utils/reviewPhotos'

interface Props {
  customerId: string
  bookingId: string
  propertyId: string
  review: MyReview | undefined
}

const STATUS_COPY: Record<MyReview['status'], { label: string; className: string }> = {
  pending: { label: 'Awaiting approval', className: 'bg-gold-500/15 text-charcoal-700' },
  approved: { label: 'Published', className: 'bg-palm-green/15 text-palm-green' },
  rejected: { label: 'Not published', className: 'bg-coral-500/10 text-coral-500' },
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          <Star
            className={`h-7 w-7 ${n <= value ? 'fill-gold-500 text-gold-500' : 'text-sand-300'}`}
          />
        </button>
      ))}
    </div>
  )
}

/** Shown to a signed-in guest on a completed stay. The database re-checks that
 * the stay is theirs and forces every new or edited review into moderation. */
export function ReviewBookingPanel({ customerId, bookingId, propertyId, review }: Props) {
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(review?.rating ?? 0)
  const [comment, setComment] = useState(review?.comment ?? '')
  const [error, setError] = useState<string | null>(null)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const submit = useSubmitReview()
  const update = useUpdateMyReview()
  const [savingPhotos, setSavingPhotos] = useState(false)
  const busy = submit.isPending || update.isPending || savingPhotos

  const keptImages: ReviewImage[] = (review?.review_images ?? []).filter((i) => !removedIds.includes(i.id))
  const previews = useMemo(() => newFiles.map((f) => URL.createObjectURL(f)), [newFiles])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  function handlePick(files: FileList | null) {
    if (!files) return
    const { accepted, problem } = selectReviewPhotos(keptImages.length + newFiles.length, Array.from(files))
    setNewFiles((prev) => [...prev, ...accepted])
    setError(problem)
    if (fileInput.current) fileInput.current.value = ''
  }

  function resetForm(source: MyReview | undefined) {
    setRating(source?.rating ?? 0)
    setComment(source?.comment ?? '')
    setNewFiles([])
    setRemovedIds([])
    setError(null)
  }

  async function handleSave() {
    setError(null)
    if (rating < 1) {
      setError('Please choose a star rating.')
      return
    }

    let reviewId = review?.id
    try {
      if (review) {
        await update.mutateAsync({ id: review.id, rating, comment })
      } else {
        reviewId = crypto.randomUUID()
        await submit.mutateAsync({ id: reviewId, customerId, propertyId, bookingId, rating, comment })
      }
    } catch {
      setError("We couldn't save your review. Please try again.")
      return
    }

    // The review itself is saved; photos are attached afterwards, so a photo
    // problem never loses what the guest wrote.
    let photoFailures = 0
    if (reviewId && (newFiles.length > 0 || removedIds.length > 0)) {
      setSavingPhotos(true)
      for (const id of removedIds) {
        const image = review?.review_images.find((i) => i.id === id)
        if (!image) continue
        try {
          await deleteReviewImage(image)
        } catch {
          photoFailures += 1
        }
      }
      for (const file of newFiles) {
        try {
          await uploadReviewImage(customerId, reviewId, file)
        } catch {
          photoFailures += 1
        }
      }
      setSavingPhotos(false)
      await queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    }

    // Tell the business about a NEW review once its photos are in, so the
    // email can mention them. Fire-and-forget; edits don't send another.
    if (!review) notifyBooking('review_submitted', bookingId)

    setNewFiles([])
    setRemovedIds([])
    setEditing(false)
    if (photoFailures > 0) {
      setError(
        `Your review was saved, but ${photoFailures} photo change${photoFailures === 1 ? '' : 's'} didn't go through. Use Edit your review to try again.`,
      )
    }
  }

  if (review && !editing) {
    const status = STATUS_COPY[review.status]
    return (
      <div className="mt-2 rounded-lg border border-sand-200 bg-sand-100/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1" aria-label={`Your rating: ${review.rating} of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-4 w-4 ${n <= review.rating ? 'fill-gold-500 text-gold-500' : 'text-sand-300'}`}
              />
            ))}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>
        {review.comment && <p className="mt-2 text-sm text-charcoal-700">{review.comment}</p>}
        {review.review_images.length > 0 && (
          <div className="mt-2 flex gap-2">
            {review.review_images.map((img) => (
              <img
                key={img.id}
                src={getResizedImageUrl('review-images', img.storage_path, 200)}
                alt="Your review photo"
                className="h-16 w-16 rounded-lg object-cover"
              />
            ))}
          </div>
        )}
        {error && <p className="mt-2 text-xs text-coral-500">{error}</p>}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 text-xs font-medium text-teal-800 hover:underline"
        >
          Edit your review
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-sand-200 bg-sand-100/60 p-4">
      <p className="text-sm font-medium text-teal-900">
        {review ? 'Edit your review' : 'How was your stay?'}
      </p>
      <p className="mt-0.5 text-xs text-charcoal-500">
        {review
          ? 'Changes go back to us for approval before showing on the property page.'
          : 'Your review appears on the property page once we approve it.'}
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <StarPicker value={rating} onChange={setRating} />
        <TextareaField
          label="Your comments (optional)"
          rows={3}
          maxLength={REVIEW_COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What did you enjoy? Anything others should know?"
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-charcoal-700">
            Photos (optional, up to {MAX_REVIEW_PHOTOS})
          </span>
          <div className="flex flex-wrap gap-2">
            {keptImages.map((img) => (
              <div key={img.id} className="relative">
                <img
                  src={getResizedImageUrl('review-images', img.storage_path, 200)}
                  alt="Photo on your review"
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setRemovedIds((prev) => [...prev, img.id])}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-charcoal-900 text-sand-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {previews.map((url, i) => (
              <div key={url} className="relative">
                <img src={url} alt="New photo to upload" className="h-16 w-16 rounded-lg object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-charcoal-900 text-sand-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {keptImages.length + newFiles.length < MAX_REVIEW_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label="Add photos"
                className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-sand-400 text-xs text-charcoal-500 hover:bg-sand-100"
              >
                <ImagePlus className="h-5 w-5" />
                Add
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            data-testid="review-photo-input"
            onChange={(e) => handlePick(e.target.files)}
          />
          <p className="text-xs text-charcoal-500">
            Adding or changing photos sends your review back to us for approval.
          </p>
        </div>
        {error && <p className="text-xs text-coral-500">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" loading={busy} onClick={handleSave}>
            {review ? 'Save changes' : 'Submit review'}
          </Button>
          {review && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setEditing(false)
                resetForm(review)
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

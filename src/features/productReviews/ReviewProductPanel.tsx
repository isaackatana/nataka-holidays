import { useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/TextareaField'
import { StarPicker } from '@/components/shared/StarPicker'
import { useSubmitProductReview, useUpdateMyProductReview } from '@/features/productReviews/queries'
import { PRODUCT_REVIEW_COMMENT_MAX, type MyProductReview } from '@/services/shopReviews.service'

interface Props {
  customerId: string
  productId: string
  orderId: string
  review: MyProductReview | undefined
}

const STATUS_COPY: Record<MyProductReview['status'], { label: string; className: string }> = {
  pending: { label: 'Awaiting approval', className: 'bg-gold-500/15 text-charcoal-700' },
  approved: { label: 'Published', className: 'bg-palm-green/15 text-palm-green' },
  rejected: { label: 'Not published', className: 'bg-coral-500/10 text-coral-500' },
}

/** Shown to a signed-in guest on a completed order, for a product in it. New and edited reviews go to us for approval. */
export function ReviewProductPanel({ customerId, productId, orderId, review }: Props) {
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(review?.rating ?? 0)
  const [comment, setComment] = useState(review?.comment ?? '')
  const [error, setError] = useState<string | null>(null)
  const submit = useSubmitProductReview()
  const update = useUpdateMyProductReview()
  const busy = submit.isPending || update.isPending

  async function handleSave() {
    setError(null)
    if (rating < 1) {
      setError('Please choose a star rating.')
      return
    }
    try {
      if (review) await update.mutateAsync({ id: review.id, rating, comment })
      else await submit.mutateAsync({ customerId, productId, orderId, rating, comment })
      setEditing(false)
    } catch {
      setError("We couldn't save your review. Please try again.")
    }
  }

  if (review && !editing) {
    const status = STATUS_COPY[review.status]
    return (
      <div className="mt-3 w-full rounded-lg border border-sand-200 bg-sand-100/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1" aria-label={`Your rating: ${review.rating} of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-4 w-4 ${n <= review.rating ? 'fill-gold-500 text-gold-500' : 'text-sand-300'}`}
              />
            ))}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
        </div>
        {review.comment && <p className="mt-2 text-sm text-charcoal-700">{review.comment}</p>}
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
    <div className="mt-3 w-full rounded-lg border border-sand-200 bg-sand-100/60 p-4">
      <p className="text-sm font-medium text-teal-900">{review ? 'Edit your review' : 'How is it?'}</p>
      <p className="mt-0.5 text-xs text-charcoal-500">
        {review
          ? 'Changes go back to us for approval before showing on the product page.'
          : 'Your review appears on the product page once we approve it.'}
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <StarPicker value={rating} onChange={setRating} />
        <TextareaField
          label="Your comments (optional)"
          rows={3}
          maxLength={PRODUCT_REVIEW_COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What do you like about it? Anything others should know?"
        />
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
                setRating(review.rating)
                setComment(review.comment ?? '')
                setError(null)
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

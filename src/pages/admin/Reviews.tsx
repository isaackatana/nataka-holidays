import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, Check, X, Trash2 } from 'lucide-react'
import { useAdminReviews, useUpdateReviewStatus, useDeleteReview } from '@/features/admin/reviews/queries'
import type { ReviewStatus } from '@/types/domain'

const STATUS_TABS: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? 'fill-gold-500 text-gold-500' : 'text-sand-300'}`}
        />
      ))}
    </div>
  )
}

export default function AdminReviews() {
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('pending')
  const { data: reviews, isLoading } = useAdminReviews(
    statusFilter === 'all' ? {} : { status: statusFilter },
  )
  const updateStatus = useUpdateReviewStatus()
  const deleteReview = useDeleteReview()

  function handleDelete(id: string) {
    if (!window.confirm("Delete this review? This can't be undone.")) return
    deleteReview.mutate(id)
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-2xl font-medium text-teal-900">Reviews</h1>
      <p className="mt-1 text-sm text-charcoal-500">
        Only approved reviews show on property pages — new reviews start as pending.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-teal-900 text-sand-50'
                : 'bg-sand-100 text-charcoal-600 hover:bg-sand-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-sand-200" />
          ))}

        {!isLoading && reviews?.length === 0 && (
          <div className="rounded-card border border-sand-200 bg-sand-50 py-12 text-center text-charcoal-500">
            No {statusFilter !== 'all' ? statusFilter : ''} reviews.
          </div>
        )}

        {reviews?.map((review) => (
          <div
            key={review.id}
            className="flex flex-col gap-3 rounded-card border border-sand-200 bg-sand-50 p-5 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Stars rating={review.rating} />
                <span className="text-sm font-medium text-charcoal-900">
                  {review.profiles?.full_name ?? 'Anonymous guest'}
                </span>
              </div>
              {review.properties ? (
                <Link
                  to={`/stays/${review.properties.slug}`}
                  className="mt-1 inline-block text-xs text-teal-800 hover:underline"
                >
                  {review.properties.title}
                </Link>
              ) : (
                <p className="mt-1 text-xs text-charcoal-600">Deleted property</p>
              )}
              {review.comment && (
                <p className="mt-2 text-sm text-charcoal-700">"{review.comment}"</p>
              )}
            </div>

            <div className="flex shrink-0 gap-2">
              {review.status !== 'approved' && (
                <button
                  onClick={() => updateStatus.mutate({ id: review.id, status: 'approved' })}
                  className="flex items-center gap-1.5 rounded-full bg-teal-900 px-3 py-1.5 text-xs font-medium text-sand-50 hover:bg-teal-800"
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </button>
              )}
              {review.status !== 'rejected' && (
                <button
                  onClick={() => updateStatus.mutate({ id: review.id, status: 'rejected' })}
                  className="flex items-center gap-1.5 rounded-full border border-sand-300 px-3 py-1.5 text-xs font-medium text-charcoal-700 hover:bg-sand-100"
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </button>
              )}
              <button
                onClick={() => handleDelete(review.id)}
                aria-label="Delete review"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-sand-300 text-coral-500 hover:bg-coral-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

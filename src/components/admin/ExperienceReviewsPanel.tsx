import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, Check, X, Trash2 } from 'lucide-react'
import { ReviewReplyEditor } from '@/components/admin/ReviewReplyEditor'
import {
  useAdminExperienceReviews,
  useDeleteExperienceReview,
  useSetExperienceReviewReply,
  useUpdateExperienceReviewStatus,
} from '@/features/admin/experienceReviews/queries'
import type { ReviewStatus } from '@/types/domain'

const STATUS_TABS: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

function ReplyEditor({ reviewId, initial }: { reviewId: string; initial: string | null }) {
  const save = useSetExperienceReviewReply()
  return (
    <ReviewReplyEditor
      reviewId={reviewId}
      initial={initial}
      isSaving={save.isPending}
      onSave={async (reply) => {
        await save.mutateAsync({ id: reviewId, reply })
      }}
    />
  )
}

/** Moderation list for guest reviews of experiences: approve, reject, reply, delete. */
export function ExperienceReviewsPanel() {
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('pending')
  const { data: reviews, isLoading, isError } = useAdminExperienceReviews(
    statusFilter === 'all' ? undefined : statusFilter,
  )
  const updateStatus = useUpdateExperienceReviewStatus()
  const deleteReview = useDeleteExperienceReview()

  function handleDelete(id: string) {
    if (!window.confirm("Delete this review? This can't be undone.")) return
    deleteReview.mutate(id)
  }

  return (
    <div>
      <p className="text-sm text-charcoal-500">
        Only approved reviews show on experience pages. A guest can review an experience once you mark their
        request Completed.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab.value ? 'bg-teal-900 text-sand-50' : 'bg-sand-100 text-charcoal-600 hover:bg-sand-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isError && (
        <p className="mt-6 text-sm text-coral-500">
          Couldn't load experience reviews. If you haven't yet, run migration 0026_experience_reviews.sql in Supabase.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {isLoading && Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-card bg-sand-200" />)}

        {!isLoading && !isError && reviews?.length === 0 && (
          <div className="rounded-card border border-sand-200 bg-sand-50 py-12 text-center text-charcoal-500">
            No {statusFilter !== 'all' ? statusFilter : ''} experience reviews.
          </div>
        )}

        {reviews?.map((review) => (
          <div
            key={review.id}
            className="flex flex-col gap-3 rounded-card border border-sand-200 bg-sand-50 p-5 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-gold-500 text-gold-500' : 'text-sand-300'}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-charcoal-900">
                  {review.profiles?.full_name ?? review.reviewer_name ?? 'Anonymous guest'}
                </span>
              </div>
              {review.experiences ? (
                <Link
                  to={`/experiences/${review.experiences.slug}`}
                  className="mt-1 inline-block text-xs text-teal-800 hover:underline"
                >
                  {review.experiences.title}
                </Link>
              ) : (
                <p className="mt-1 text-xs text-charcoal-600">Deleted experience</p>
              )}
              {review.comment && <p className="mt-2 text-sm text-charcoal-700">"{review.comment}"</p>}
              <ReplyEditor key={review.id + (review.owner_reply ?? '')} reviewId={review.id} initial={review.owner_reply} />
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

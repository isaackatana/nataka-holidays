import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAllReviewsForAdmin,
  updateReviewStatus,
  deleteReview,
  getPendingReviewCount,
  setOwnerReply,
  type AdminReviewFilters,
} from '@/services/admin/reviews.service'
import type { ReviewStatus } from '@/types/domain'

export function useAdminReviews(filters: AdminReviewFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'reviews', 'list', filters],
    queryFn: () => getAllReviewsForAdmin(filters),
  })
}

function useInvalidateReviewCaches() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    // Public property pages show approved reviews (useApprovedReviews,
    // keyed ['reviews', propertyId]) — a status change here should be
    // reflected there too. Invalidating the ['reviews'] prefix catches it.
    queryClient.invalidateQueries({ queryKey: ['reviews'] })
  }
}

export function useUpdateReviewStatus() {
  const invalidate = useInvalidateReviewCaches()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) => updateReviewStatus(id, status),
    onSuccess: invalidate,
  })
}

export function useDeleteReview() {
  const invalidate = useInvalidateReviewCaches()
  return useMutation({
    mutationFn: (id: string) => deleteReview(id),
    onSuccess: invalidate,
  })
}

export function useSetOwnerReply() {
  const invalidate = useInvalidateReviewCaches()
  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => setOwnerReply(id, reply),
    onSuccess: invalidate,
  })
}

/** Reviews awaiting approval. Under the ['admin','reviews'] prefix, so approving,
 * rejecting or deleting a review refreshes the count straight away. */
export function usePendingReviewCount() {
  return useQuery({
    queryKey: ['admin', 'reviews', 'pending-count'],
    queryFn: getPendingReviewCount,
    refetchInterval: 60_000,
  })
}

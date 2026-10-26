import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteProductReview,
  getAllProductReviewsForAdmin,
  getPendingProductReviewCount,
  setProductReviewReply,
  updateProductReviewStatus,
} from '@/services/admin/shopReviews.service'
import type { ReviewStatus } from '@/types/domain'

export function useAdminProductReviews(status?: ReviewStatus) {
  return useQuery({
    queryKey: ['admin', 'product-reviews', 'list', status ?? 'all'],
    queryFn: () => getAllProductReviewsForAdmin({ status }),
  })
}

export function usePendingProductReviewCount() {
  return useQuery({
    queryKey: ['admin', 'product-reviews', 'pending-count'],
    queryFn: getPendingProductReviewCount,
    refetchInterval: 60_000,
    retry: false,
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'product-reviews'] })
    // Public product pages and cards show approved reviews and ratings.
    queryClient.invalidateQueries({ queryKey: ['product-reviews'] })
    queryClient.invalidateQueries({ queryKey: ['my-product-reviews'] })
  }
}

export function useUpdateProductReviewStatus() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) => updateProductReviewStatus(id, status),
    onSuccess: invalidate,
  })
}

export function useDeleteProductReview() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => deleteProductReview(id), onSuccess: invalidate })
}

export function useSetProductReviewReply() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => setProductReviewReply(id, reply),
    onSuccess: invalidate,
  })
}

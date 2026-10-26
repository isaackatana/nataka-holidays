import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getApprovedProductReviews,
  getProductRatings,
  getMyProductReviews,
  submitProductReview,
  updateMyProductReview,
  type SubmitProductReviewInput,
} from '@/services/shopReviews.service'

export function useApprovedProductReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-reviews', 'approved', productId],
    queryFn: () => getApprovedProductReviews(productId!),
    enabled: !!productId,
  })
}

/** Ratings for all products, for the cards. A failure just shows no stars. */
export function useProductRatings() {
  return useQuery({
    queryKey: ['product-reviews', 'ratings'],
    queryFn: getProductRatings,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useMyProductReviews(customerId: string | undefined) {
  return useQuery({
    queryKey: ['my-product-reviews', customerId],
    queryFn: () => getMyProductReviews(customerId!),
    enabled: !!customerId,
    retry: false,
  })
}

function useInvalidateOnChange() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['my-product-reviews'] })
    queryClient.invalidateQueries({ queryKey: ['product-reviews'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'product-reviews'] })
  }
}

export function useSubmitProductReview() {
  const invalidate = useInvalidateOnChange()
  return useMutation({
    mutationFn: (input: SubmitProductReviewInput) => submitProductReview(input),
    onSuccess: invalidate,
  })
}

export function useUpdateMyProductReview() {
  const invalidate = useInvalidateOnChange()
  return useMutation({
    mutationFn: ({ id, rating, comment }: { id: string; rating: number; comment: string }) =>
      updateMyProductReview(id, rating, comment),
    onSuccess: invalidate,
  })
}

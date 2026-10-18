import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getApprovedReviews,
  getFeaturedReviews,
  getMyReviews,
  getPropertyRatings,
  submitReview,
  updateMyReview,
  type SubmitReviewInput,
} from '@/services/reviews.service'

export function useApprovedReviews(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['reviews', propertyId],
    queryFn: () => getApprovedReviews(propertyId!),
    enabled: !!propertyId,
  })
}

export function useMyReviews(customerId: string | undefined) {
  return useQuery({
    queryKey: ['my-reviews', customerId],
    queryFn: () => getMyReviews(customerId!),
    enabled: !!customerId,
  })
}

export function useSubmitReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SubmitReviewInput) => submitReview(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    },
  })
}

export function useUpdateMyReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rating, comment }: { id: string; rating: number; comment: string }) =>
      updateMyReview(id, rating, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] })
      // An edited review leaves the public page until re-approved.
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
    },
  })
}

/** Ratings for all properties, for listing cards. Ratings are a nicety, so a
 * failure shows no stars rather than an error. */
export function usePropertyRatings() {
  return useQuery({
    // Under the ['reviews'] prefix so approving/rejecting a review refreshes it.
    queryKey: ['reviews', 'ratings'],
    queryFn: getPropertyRatings,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

/** Good recent reviews for the home page. */
export function useFeaturedReviews() {
  return useQuery({
    queryKey: ['reviews', 'featured'],
    queryFn: () => getFeaturedReviews(3),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

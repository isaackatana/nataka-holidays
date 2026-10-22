import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getApprovedExperienceReviews,
  getExperienceRatings,
  getMyExperienceReviews,
  submitExperienceReview,
  updateMyExperienceReview,
  type SubmitExperienceReviewInput,
} from '@/services/experienceReviews.service'

export function useApprovedExperienceReviews(experienceId: string | undefined) {
  return useQuery({
    queryKey: ['experience-reviews', 'approved', experienceId],
    queryFn: () => getApprovedExperienceReviews(experienceId!),
    enabled: !!experienceId,
  })
}

/** Ratings for all experiences, for the cards. A failure just shows no stars. */
export function useExperienceRatings() {
  return useQuery({
    queryKey: ['experience-reviews', 'ratings'],
    queryFn: getExperienceRatings,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useMyExperienceReviews(customerId: string | undefined) {
  return useQuery({
    queryKey: ['my-experience-reviews', customerId],
    queryFn: () => getMyExperienceReviews(customerId!),
    enabled: !!customerId,
    retry: false,
  })
}

function useInvalidateOnChange() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['my-experience-reviews'] })
    queryClient.invalidateQueries({ queryKey: ['experience-reviews'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'experience-reviews'] })
  }
}

export function useSubmitExperienceReview() {
  const invalidate = useInvalidateOnChange()
  return useMutation({
    mutationFn: (input: SubmitExperienceReviewInput) => submitExperienceReview(input),
    onSuccess: invalidate,
  })
}

export function useUpdateMyExperienceReview() {
  const invalidate = useInvalidateOnChange()
  return useMutation({
    mutationFn: ({ id, rating, comment }: { id: string; rating: number; comment: string }) =>
      updateMyExperienceReview(id, rating, comment),
    onSuccess: invalidate,
  })
}

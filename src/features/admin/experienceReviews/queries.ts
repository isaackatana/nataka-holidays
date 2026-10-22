import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteExperienceReview,
  getAllExperienceReviewsForAdmin,
  getPendingExperienceReviewCount,
  setExperienceReviewReply,
  updateExperienceReviewStatus,
} from '@/services/admin/experienceReviews.service'
import type { ReviewStatus } from '@/types/domain'

export function useAdminExperienceReviews(status?: ReviewStatus) {
  return useQuery({
    queryKey: ['admin', 'experience-reviews', 'list', status ?? 'all'],
    queryFn: () => getAllExperienceReviewsForAdmin({ status }),
  })
}

export function usePendingExperienceReviewCount() {
  return useQuery({
    queryKey: ['admin', 'experience-reviews', 'pending-count'],
    queryFn: getPendingExperienceReviewCount,
    refetchInterval: 60_000,
    retry: false,
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'experience-reviews'] })
    // Public experience pages and cards show approved reviews and ratings.
    queryClient.invalidateQueries({ queryKey: ['experience-reviews'] })
    queryClient.invalidateQueries({ queryKey: ['my-experience-reviews'] })
  }
}

export function useUpdateExperienceReviewStatus() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) => updateExperienceReviewStatus(id, status),
    onSuccess: invalidate,
  })
}

export function useDeleteExperienceReview() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => deleteExperienceReview(id), onSuccess: invalidate })
}

export function useSetExperienceReviewReply() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => setExperienceReviewReply(id, reply),
    onSuccess: invalidate,
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getMyExperienceRequests,
  submitExperienceRequest,
  type ExperienceRequestInput,
} from '@/services/experienceRequests.service'
import { notifyExperienceRequest } from '@/services/notify.service'

export function useSubmitExperienceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ExperienceRequestInput) => submitExperienceRequest(input),
    onSuccess: (_data, input) => {
      notifyExperienceRequest(input.id) // fire-and-forget emails
      queryClient.invalidateQueries({ queryKey: ['my-experience-requests'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'experience-requests'] })
    },
  })
}

export function useMyExperienceRequests(customerId: string | undefined) {
  return useQuery({
    queryKey: ['my-experience-requests', customerId],
    queryFn: () => getMyExperienceRequests(customerId!),
    enabled: !!customerId,
    retry: false,
  })
}

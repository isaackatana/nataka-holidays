import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getExperienceAmountDue,
  getMyExperiencePayments,
  payForExperience,
  type ExperiencePayment,
} from '@/services/experiencePayments.service'

/** The signed-in guest's experience payments. Re-checks every few seconds while a prompt is waiting for the PIN. */
export function useMyExperiencePayments(customerId: string | undefined) {
  return useQuery({
    queryKey: ['my-experience-payments', customerId],
    queryFn: getMyExperiencePayments,
    enabled: !!customerId,
    retry: false,
    refetchInterval: (query) =>
      (query.state.data as ExperiencePayment[] | undefined)?.some((p) => p.status === 'pending') ? 4000 : false,
  })
}

/** What is owed now on one request; refreshed whenever the payment list changes. */
export function useExperienceAmountDue(requestId: string, enabled: boolean, paymentsKey: string) {
  return useQuery({
    queryKey: ['experience-amount-due', requestId, paymentsKey],
    queryFn: () => getExperienceAmountDue(requestId),
    enabled,
    retry: false,
  })
}

export function usePayForExperience() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { requestId: string; phone: string }) => payForExperience(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-experience-payments'] })
      queryClient.invalidateQueries({ queryKey: ['experience-amount-due'] })
    },
  })
}

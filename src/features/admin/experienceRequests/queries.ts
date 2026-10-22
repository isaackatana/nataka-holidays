import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteExperienceRequest,
  getExperienceRequestsForAdmin,
  getNewExperienceRequestCount,
  updateExperienceRequestStatus,
} from '@/services/admin/experienceRequests.service'
import {
  getAllExperiencePayments,
  recordExperiencePayment,
  setAgreedTotal,
  type RecordExperiencePaymentInput,
} from '@/services/admin/experienceRequestPayments.service'
import type { ExperienceRequestStatus } from '@/services/experienceRequests.service'

export function useAdminExperienceRequests(status?: ExperienceRequestStatus) {
  return useQuery({
    queryKey: ['admin', 'experience-requests', 'list', status ?? 'all'],
    queryFn: () => getExperienceRequestsForAdmin(status),
  })
}

/** New requests, for the menu badge. Refreshes after any change made here. */
export function useNewExperienceRequestCount() {
  return useQuery({
    queryKey: ['admin', 'experience-requests', 'new-count'],
    queryFn: getNewExperienceRequestCount,
    refetchInterval: 60_000,
    retry: false,
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'experience-requests'] })
    queryClient.invalidateQueries({ queryKey: ['my-experience-requests'] })
    queryClient.invalidateQueries({ queryKey: ['my-experience-payments'] })
    queryClient.invalidateQueries({ queryKey: ['experience-amount-due'] })
  }
}

export function useUpdateExperienceRequestStatus() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ExperienceRequestStatus }) =>
      updateExperienceRequestStatus(id, status),
    onSuccess: invalidate,
  })
}

export function useDeleteExperienceRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => deleteExperienceRequest(id),
    onSuccess: invalidate,
  })
}

/** All experience payments, for the requests page. Re-checks while an M-Pesa prompt is still waiting. */
export function useAdminExperiencePayments() {
  return useQuery({
    queryKey: ['admin', 'experience-requests', 'payments'],
    queryFn: getAllExperiencePayments,
    retry: false,
    refetchInterval: (query) =>
      (query.state.data as { status: string }[] | undefined)?.some((p) => p.status === 'pending') ? 5000 : false,
  })
}

export function useRecordExperiencePayment() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: RecordExperiencePaymentInput) => recordExperiencePayment(input),
    onSuccess: invalidate,
  })
}

export function useSetAgreedTotal() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ requestId, total }: { requestId: string; total: number | null }) => setAgreedTotal(requestId, total),
    onSuccess: invalidate,
  })
}

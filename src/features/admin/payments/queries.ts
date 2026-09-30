import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPayments, requestPayment, type Payment, type PaymentRequestInput } from '@/services/admin/payments.service'

/** Polls every 4s while any payment is still waiting on the guest's PIN. */
export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: getPayments,
    refetchInterval: (query) =>
      (query.state.data as Payment[] | undefined)?.some((p) => p.status === 'pending') ? 4000 : false,
  })
}

export function useRequestPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentRequestInput) => requestPayment(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  })
}

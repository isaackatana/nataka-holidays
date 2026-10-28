import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelBackInStock, getBackInStockCounts, getMyBackInStock, requestBackInStock } from '@/services/backInStock.service'

export function useMyBackInStock(customerId: string | undefined) {
  return useQuery({
    queryKey: ['back-in-stock', 'mine', customerId],
    queryFn: () => getMyBackInStock(customerId as string),
    enabled: !!customerId,
  })
}

export function useRequestBackInStock(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, variantId }: { productId: string; variantId: string | null }) =>
      requestBackInStock(customerId, productId, variantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['back-in-stock'] }),
  })
}

export function useCancelBackInStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelBackInStock(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['back-in-stock'] }),
  })
}

export function useBackInStockCounts() {
  return useQuery({ queryKey: ['back-in-stock', 'counts'], queryFn: getBackInStockCounts })
}

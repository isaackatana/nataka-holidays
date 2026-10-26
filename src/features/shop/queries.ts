import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelMyOrder, checkDiscountCode, getMyOrders, getShopProduct, getShopProducts, payForOrder, placeOrder, type PlaceOrderInput } from '@/services/shop.service'

export function useShopProducts() {
  return useQuery({ queryKey: ['shop', 'products'], queryFn: getShopProducts })
}

export function useShopProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ['shop', 'product', slug],
    queryFn: () => getShopProduct(slug as string),
    enabled: !!slug,
  })
}

export function useCheckDiscountCode() {
  return useMutation({ mutationFn: ({ code, subtotal }: { code: string; subtotal: number }) => checkDiscountCode(code, subtotal) })
}

export function usePlaceOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PlaceOrderInput) => placeOrder(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop'] })
    },
  })
}

/** The signed-in customer's orders. Refreshes every few seconds while one is waiting for payment. */
export function useMyOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ['shop', 'my-orders', userId],
    queryFn: getMyOrders,
    enabled: !!userId,
    refetchInterval: (query) => (query.state.data?.some((o) => o.status === 'pending_payment') ? 4000 : false),
  })
}

export function usePayForOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: payForOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shop', 'my-orders'] }),
  })
}

export function useCancelMyOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => cancelMyOrder(orderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shop'] }),
  })
}

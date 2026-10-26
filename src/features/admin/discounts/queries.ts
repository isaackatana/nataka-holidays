import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDiscountCode, deleteDiscountCode, getDiscountCodes, setDiscountCodeActive, type DiscountInput,
} from '@/services/admin/discounts.service'

export function useDiscountCodes() {
  return useQuery({ queryKey: ['admin', 'discounts'], queryFn: getDiscountCodes })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['admin', 'discounts'] })
}

export function useCreateDiscountCode() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (input: DiscountInput) => createDiscountCode(input), onSuccess: invalidate })
}

export function useSetDiscountCodeActive() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setDiscountCodeActive(id, isActive),
    onSuccess: invalidate,
  })
}

export function useDeleteDiscountCode() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => deleteDiscountCode(id), onSuccess: invalidate })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBlock, deleteBlock, getBlocksForProperty, type NewBlock } from '@/services/admin/bookingBlocks.service'

function useInvalidateAvailability() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'booking-blocks'] })
    queryClient.invalidateQueries({ queryKey: ['booking-blocks'] })
    queryClient.invalidateQueries({ queryKey: ['properties'] }) // date-filtered search results
  }
}

export function useAdminBlocks(propertyId: string) {
  return useQuery({
    queryKey: ['admin', 'booking-blocks', propertyId],
    queryFn: () => getBlocksForProperty(propertyId),
  })
}

export function useCreateBlock() {
  const invalidate = useInvalidateAvailability()
  return useMutation({ mutationFn: (input: NewBlock) => createBlock(input), onSuccess: invalidate })
}

export function useDeleteBlock() {
  const invalidate = useInvalidateAvailability()
  return useMutation({ mutationFn: (id: string) => deleteBlock(id), onSuccess: invalidate })
}

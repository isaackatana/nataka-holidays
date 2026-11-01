import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addProductFavorite, getProductFavoriteIds, removeProductFavorite } from '@/services/productFavorites.service'

export function useProductFavoriteIds(customerId: string | undefined) {
  return useQuery({
    queryKey: ['product-favorites', customerId],
    queryFn: () => getProductFavoriteIds(customerId as string),
    enabled: !!customerId,
  })
}

/** Flips the heart straight away and puts it back if saving fails. */
export function useToggleProductFavorite(customerId: string | undefined) {
  const queryClient = useQueryClient()
  const key = ['product-favorites', customerId]

  return useMutation({
    mutationFn: async ({ productId, saved }: { productId: string; saved: boolean }) => {
      if (!customerId) throw new Error('Sign in to save items.')
      if (saved) await removeProductFavorite(customerId, productId)
      else await addProductFavorite(customerId, productId)
    },
    onMutate: async ({ productId, saved }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<string[]>(key) ?? []
      queryClient.setQueryData<string[]>(key, saved ? previous.filter((id) => id !== productId) : [productId, ...previous])
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

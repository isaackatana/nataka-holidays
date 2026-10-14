import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProduct, deleteProduct, getAllOrdersForAdmin, getAllProductsForAdmin, markOrderPaid,
  removeProductImage, setOrderStatus, updateProduct, uploadProductImage, type ProductInput,
} from '@/services/admin/shop.service'
import type { Product } from '@/types/domain'

function useInvalidateShop() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['shop'] }).then(() => queryClient.invalidateQueries({ queryKey: ['admin', 'shop'] }))
}

export function useAdminProducts() {
  return useQuery({ queryKey: ['admin', 'shop', 'products'], queryFn: getAllProductsForAdmin })
}

export interface SaveProductArgs {
  id?: string
  input: Omit<ProductInput, 'image_path'>
  /** A newly chosen photo, if any. */
  file?: File | null
  /** The photo already on the product (kept unless `removeImage` or a new `file`). */
  currentImagePath: string | null
  removeImage?: boolean
}

export function useSaveProduct() {
  const invalidate = useInvalidateShop()
  return useMutation({
    mutationFn: async ({ id, input, file, currentImagePath, removeImage }: SaveProductArgs) => {
      let image_path = removeImage ? null : currentImagePath
      let uploaded: string | null = null
      if (file) {
        uploaded = await uploadProductImage(file)
        image_path = uploaded
      }
      try {
        const saved = id ? await updateProduct(id, { ...input, image_path }) : await createProduct({ ...input, image_path })
        if (currentImagePath && currentImagePath !== image_path) await removeProductImage(currentImagePath)
        return saved
      } catch (err) {
        if (uploaded) await removeProductImage(uploaded) // don't leave an orphan file behind
        throw err
      }
    },
    onSuccess: invalidate,
  })
}

export function useDeleteProduct() {
  const invalidate = useInvalidateShop()
  return useMutation({ mutationFn: (p: Product) => deleteProduct(p), onSuccess: invalidate })
}

export function useAdminOrders() {
  return useQuery({
    queryKey: ['admin', 'shop', 'orders'],
    queryFn: getAllOrdersForAdmin,
    refetchInterval: 15000,
  })
}

export function useSetOrderStatus() {
  const invalidate = useInvalidateShop()
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: 'packed' | 'completed' | 'cancelled' }) => setOrderStatus(orderId, status),
    onSuccess: invalidate,
  })
}

export function useMarkOrderPaid() {
  const invalidate = useInvalidateShop()
  return useMutation({
    mutationFn: ({ orderId, via }: { orderId: string; via: 'cash' | 'other' }) => markOrderPaid(orderId, via),
    onSuccess: invalidate,
  })
}

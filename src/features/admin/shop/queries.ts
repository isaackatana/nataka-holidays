import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addProductVariant, deleteProductVariant, updateProductVariant,
  createProduct, deleteProduct, deleteProductImage, getAllOrdersForAdmin, getAllProductsForAdmin, markOrderPaid,
  reorderProductImages, setOrderStatus, updateProduct, uploadProductImage, type ProductInput,
} from '@/services/admin/shop.service'
import type { ProductImage, ProductWithImages } from '@/types/domain'

function useInvalidateShop() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['shop'] }).then(() => queryClient.invalidateQueries({ queryKey: ['admin', 'shop'] }))
}

export function useAdminProducts() {
  return useQuery({ queryKey: ['admin', 'shop', 'products'], queryFn: getAllProductsForAdmin })
}

export function useSaveProduct() {
  const invalidate = useInvalidateShop()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ProductInput }) => (id ? updateProduct(id, input) : createProduct(input)),
    onSuccess: invalidate,
  })
}

export function useUploadProductImage(productId: string) {
  const invalidate = useInvalidateShop()
  return useMutation({
    mutationFn: ({ file, currentCount }: { file: File; currentCount: number }) => uploadProductImage(productId, file, currentCount),
    onSuccess: invalidate,
  })
}

export function useAddVariant(productId: string) {
  const invalidate = useInvalidateShop()
  return useMutation({
    mutationFn: ({ name, stock, sortOrder }: { name: string; stock: number; sortOrder: number }) => addProductVariant(productId, name, stock, sortOrder),
    onSuccess: invalidate,
  })
}

export function useUpdateVariant() {
  const invalidate = useInvalidateShop()
  return useMutation({
    mutationFn: ({ id, name, stock }: { id: string; name: string; stock: number }) => updateProductVariant(id, name, stock),
    onSuccess: invalidate,
  })
}

export function useDeleteVariant() {
  const invalidate = useInvalidateShop()
  return useMutation({ mutationFn: (id: string) => deleteProductVariant(id), onSuccess: invalidate })
}

export function useDeleteProductImage() {
  const invalidate = useInvalidateShop()
  return useMutation({ mutationFn: (image: ProductImage) => deleteProductImage(image), onSuccess: invalidate })
}

export function useReorderProductImages(productId: string) {
  const invalidate = useInvalidateShop()
  return useMutation({ mutationFn: (ids: string[]) => reorderProductImages(productId, ids), onSuccess: invalidate })
}

export function useDeleteProduct() {
  const invalidate = useInvalidateShop()
  return useMutation({ mutationFn: (p: ProductWithImages) => deleteProduct(p), onSuccess: invalidate })
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

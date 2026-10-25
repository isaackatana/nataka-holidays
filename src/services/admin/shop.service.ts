import { supabase } from '@/lib/supabase'
import { prepareImageForUpload } from '@/utils/image'
import type { Order, OrderStatus, Product, ProductImage, ProductVariant, ProductWithImages } from '@/types/domain'

const BUCKET = 'product-images'
const ORDER_SELECT = '*, order_items ( id, order_id, product_id, product_name, unit_price, quantity ), order_payments ( id, order_id, amount, status, created_at )'

const IMAGE_SELECT = 'product_images ( id, product_id, storage_path, sort_order ), product_variants ( id, product_id, name, stock, sort_order )'

export async function getAllProductsForAdmin(): Promise<ProductWithImages[]> {
  await supabase.rpc('release_expired_orders' as never)
  const { data, error } = await supabase.from('products').select(`*, ${IMAGE_SELECT}`).order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as ProductWithImages[]).map((p) => ({
    ...p,
    product_images: [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    product_variants: [...(p.product_variants ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export interface ProductInput {
  name: string
  slug: string
  description: string
  price: number
  stock: number
  category: string
  is_active: boolean
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase.from('products').insert(input as never).select('*').single()
  if (error) throw error
  return data as unknown as Product
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const { data, error } = await supabase.from('products').update(input as never).eq('id', id).select('*').single()
  if (error) throw error
  return data as unknown as Product
}

export async function deleteProduct(product: ProductWithImages): Promise<void> {
  const paths = [...new Set([...product.product_images.map((i) => i.storage_path), ...(product.image_path ? [product.image_path] : [])])]
  const { error } = await supabase.from('products').delete().eq('id', product.id)
  if (error) throw error
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)
}

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
}

/** Keeps the product's cover photo (products.image_path) equal to its first gallery photo. */
async function syncCover(productId: string): Promise<void> {
  const { data, error } = await supabase
    .from('product_images')
    .select('storage_path')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .limit(1)
  if (error) throw error
  const first = (data as unknown as { storage_path: string }[] | null)?.[0]?.storage_path ?? null
  const { error: updateError } = await supabase.from('products').update({ image_path: first } as never).eq('id', productId)
  if (updateError) throw updateError
}

/** Shrinks and uploads one photo, adds it to the end of the gallery. */
export async function uploadProductImage(productId: string, file: File, currentCount: number): Promise<ProductImage> {
  const optimized = await prepareImageForUpload(file)
  const path = `${productId}/${Date.now()}-${sanitize(optimized.name)}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, optimized, {
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('product_images')
    .insert({ product_id: productId, storage_path: path, sort_order: currentCount } as never)
    .select('*')
    .single()
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]) // don't leave an orphan file behind
    throw insertError
  }
  await syncCover(productId)
  return data as unknown as ProductImage
}

export async function deleteProductImage(image: ProductImage): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([image.storage_path])
  if (storageError) throw storageError
  const { error } = await supabase.from('product_images').delete().eq('id', image.id)
  if (error) throw error
  await syncCover(image.product_id)
}

export async function reorderProductImages(productId: string, orderedImageIds: string[]): Promise<void> {
  await Promise.all(
    orderedImageIds.map((id, index) =>
      supabase
        .from('product_images')
        .update({ sort_order: index } as never)
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error
        }),
    ),
  )
  await syncCover(productId)
}

export async function addProductVariant(productId: string, name: string, stock: number, sortOrder: number): Promise<ProductVariant> {
  const { data, error } = await supabase
    .from('product_variants')
    .insert({ product_id: productId, name, stock, sort_order: sortOrder } as never)
    .select('*')
    .single()
  if (error) throw error
  return data as unknown as ProductVariant
}

export async function updateProductVariant(id: string, name: string, stock: number): Promise<void> {
  const { error } = await supabase.from('product_variants').update({ name, stock } as never).eq('id', id)
  if (error) throw error
}

/** Past orders keep their record of the option (its name was copied onto the order). */
export async function deleteProductVariant(id: string): Promise<void> {
  const { error } = await supabase.from('product_variants').delete().eq('id', id)
  if (error) throw error
}

export async function getAllOrdersForAdmin(): Promise<Order[]> {
  await supabase.rpc('release_expired_orders' as never)
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(300)
  if (error) throw error
  return (data ?? []) as unknown as Order[]
}

export async function setOrderStatus(orderId: string, status: Exclude<OrderStatus, 'pending_payment' | 'paid' | 'expired'>): Promise<void> {
  const { error } = await supabase.rpc('admin_set_order_status' as never, { p_order_id: orderId, p_status: status } as never)
  if (error) throw new Error(error.message)
}

export async function markOrderPaid(orderId: string, via: 'cash' | 'other'): Promise<void> {
  const { error } = await supabase.rpc('admin_mark_order_paid' as never, { p_order_id: orderId, p_via: via } as never)
  if (error) throw new Error(error.message)
}

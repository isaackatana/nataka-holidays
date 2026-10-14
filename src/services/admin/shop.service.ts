import { supabase } from '@/lib/supabase'
import { prepareImageForUpload } from '@/utils/image'
import type { Order, OrderStatus, Product } from '@/types/domain'

const BUCKET = 'product-images'
const ORDER_SELECT = '*, order_items ( id, order_id, product_id, product_name, unit_price, quantity ), order_payments ( id, order_id, amount, status, created_at )'

export async function getAllProductsForAdmin(): Promise<Product[]> {
  await supabase.rpc('release_expired_orders' as never)
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Product[]
}

export interface ProductInput {
  name: string
  slug: string
  description: string
  price: number
  stock: number
  image_path: string | null
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

export async function deleteProduct(product: Product): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', product.id)
  if (error) throw error
  if (product.image_path) await supabase.storage.from(BUCKET).remove([product.image_path])
}

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
}

/** Shrinks and uploads a photo; returns its storage path. */
export async function uploadProductImage(file: File): Promise<string> {
  const optimized = await prepareImageForUpload(file)
  const path = `${Date.now()}-${sanitize(optimized.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, optimized, {
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function removeProductImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.error('[removeProductImage] could not remove file:', error)
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

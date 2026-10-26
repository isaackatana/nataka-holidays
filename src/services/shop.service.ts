import { supabase } from '@/lib/supabase'
import type { Fulfilment, Order, Product, ProductWithImages } from '@/types/domain'

const ORDER_SELECT = '*, order_items ( id, order_id, product_id, product_name, unit_price, quantity ), order_payments ( id, order_id, amount, status, created_at )'

/** Active products. Releases stock held by orders nobody paid for first, so the numbers are honest. */
export async function getShopProducts(): Promise<Product[]> {
  await supabase.rpc('release_expired_orders' as never)
  const { data, error } = await supabase
    .from('products')
    .select('*, product_variants ( id )')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Product[]
}

/** One active product with all its photos, or null when the address is wrong or the product is hidden. */
export async function getShopProduct(slug: string): Promise<ProductWithImages | null> {
  await supabase.rpc('release_expired_orders' as never)
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images ( id, product_id, storage_path, sort_order ), product_variants ( id, product_id, name, stock, sort_order )')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const product = data as unknown as ProductWithImages
  return {
    ...product,
    product_images: [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    product_variants: [...(product.product_variants ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }
}

export interface PlaceOrderInput {
  items: { product_id: string; variant_id: string | null; quantity: number }[]
  fulfilment: Fulfilment
  name: string
  /** Normalised 2547XXXXXXXX. */
  phone: string
  handoverNote: string
  address: string
  /** Optional; the database checks it and works out the discount. */
  discountCode?: string
}

/** Creates the order. The database prices it, checks stock and reserves it. */
export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  const { data, error } = await supabase.rpc('create_order' as never, {
    p_items: input.items,
    p_fulfilment: input.fulfilment,
    p_name: input.name,
    p_phone: input.phone,
    p_handover_note: input.fulfilment === 'handover' ? input.handoverNote : null,
    p_address: input.fulfilment === 'delivery' ? input.address : null,
    p_discount_code: input.discountCode?.trim() || null,
  } as never)
  if (error) throw new Error(error.message)
  return data as unknown as Order
}

export type DiscountCheck = { ok: true; code: string; amount: number } | { ok: false; message: string }

/** Asks the database what a code would take off these items. Places nothing. */
export async function checkDiscountCode(code: string, subtotal: number): Promise<DiscountCheck> {
  const { data, error } = await supabase.rpc('check_discount_code' as never, { p_code: code, p_subtotal: subtotal } as never)
  if (error) throw new Error(error.message)
  const r = data as unknown as { ok: boolean; code?: string; amount?: number; message?: string }
  return r.ok
    ? { ok: true, code: r.code as string, amount: Number(r.amount) }
    : { ok: false, message: r.message ?? 'That code is not valid.' }
}

export async function getMyOrders(): Promise<Order[]> {
  await supabase.rpc('release_expired_orders' as never)
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Order[]
}

export async function cancelMyOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_order' as never, { p_order_id: orderId } as never)
  if (error) throw new Error(error.message)
}

/** Asks the server to send an M-Pesa prompt for the order. The amount is the order's own total. */
export async function payForOrder(input: { orderId: string; phone: string }): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Please sign in again.')

  const res = await fetch('/api/shop-pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Could not send the payment request.')
}

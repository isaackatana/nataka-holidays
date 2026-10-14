import { supabase } from '@/lib/supabase'
import type { Fulfilment, Order, Product } from '@/types/domain'

const ORDER_SELECT = '*, order_items ( id, order_id, product_id, product_name, unit_price, quantity ), order_payments ( id, order_id, amount, status, created_at )'

/** Active products. Releases stock held by orders nobody paid for first, so the numbers are honest. */
export async function getShopProducts(): Promise<Product[]> {
  await supabase.rpc('release_expired_orders' as never)
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Product[]
}

export interface PlaceOrderInput {
  items: { product_id: string; quantity: number }[]
  fulfilment: Fulfilment
  name: string
  /** Normalised 2547XXXXXXXX. */
  phone: string
  handoverNote: string
  address: string
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
  } as never)
  if (error) throw new Error(error.message)
  return data as unknown as Order
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

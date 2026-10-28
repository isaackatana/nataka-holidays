import { supabase } from '@/lib/supabase'
import type { BackInStockRequest } from '@/types/domain'

export async function getMyBackInStock(customerId: string): Promise<BackInStockRequest[]> {
  const { data, error } = await supabase.from('back_in_stock_requests').select('*').eq('customer_id', customerId)
  if (error) throw error
  return (data ?? []) as unknown as BackInStockRequest[]
}

export async function requestBackInStock(customerId: string, productId: string, variantId: string | null): Promise<void> {
  const { error } = await supabase
    .from('back_in_stock_requests')
    .insert({ customer_id: customerId, product_id: productId, variant_id: variantId } as never)
  if (error) {
    // Already waiting for it: that is fine, it is what they wanted.
    if (error.code === '23505') return
    throw new Error(error.message)
  }
}

export async function cancelBackInStock(id: string): Promise<void> {
  const { error } = await supabase.from('back_in_stock_requests').delete().eq('id', id)
  if (error) throw error
}

/** Admin: how many guests are waiting, per product (colours added together). */
export async function getBackInStockCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('back_in_stock_requests').select('product_id')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const r of (data ?? []) as unknown as { product_id: string }[]) counts[r.product_id] = (counts[r.product_id] ?? 0) + 1
  return counts
}

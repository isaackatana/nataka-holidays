import { supabase } from '@/lib/supabase'

/** The guest's saved product ids, newest first. */
export async function getProductFavoriteIds(customerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('product_favorites')
    .select('product_id')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as { product_id: string }[]).map((r) => r.product_id)
}

export async function addProductFavorite(customerId: string, productId: string): Promise<void> {
  const { error } = await supabase.from('product_favorites').insert({ customer_id: customerId, product_id: productId } as never)
  // Already saved is the state they wanted anyway.
  if (error && error.code !== '23505') throw new Error(error.message)
}

export async function removeProductFavorite(customerId: string, productId: string): Promise<void> {
  const { error } = await supabase.from('product_favorites').delete().eq('customer_id', customerId).eq('product_id', productId)
  if (error) throw error
}

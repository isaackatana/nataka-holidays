import { supabase } from '@/lib/supabase'
import type { ReviewStatus } from '@/types/domain'

export interface AdminProductReview {
  id: string
  rating: number
  comment: string | null
  status: ReviewStatus
  created_at: string
  owner_reply: string | null
  reviewer_name: string | null
  products: { name: string; slug: string } | null
  profiles: { full_name: string | null } | null
}

export async function getAllProductReviewsForAdmin(
  filters: { status?: ReviewStatus } = {},
): Promise<AdminProductReview[]> {
  let query = supabase
    .from('product_reviews')
    .select('id, rating, comment, status, created_at, owner_reply, reviewer_name, products ( name, slug ), profiles ( full_name )')
    .order('created_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as AdminProductReview[]
}

export async function updateProductReviewStatus(id: string, status: ReviewStatus): Promise<void> {
  const { error } = await supabase.from('product_reviews').update({ status } as never).eq('id', id)
  if (error) throw error
}

export async function deleteProductReview(id: string): Promise<void> {
  const { error } = await supabase.from('product_reviews').delete().eq('id', id)
  if (error) throw error
}

/** Saves (or, with an empty string, removes) the business's public reply. */
export async function setProductReviewReply(id: string, reply: string): Promise<void> {
  const text = reply.trim()
  const { error } = await supabase
    .from('product_reviews')
    .update({ owner_reply: text || null, owner_replied_at: text ? new Date().toISOString() : null } as never)
    .eq('id', id)
  if (error) throw error
}

/** Product reviews waiting for approval (counts rows, loads none). */
export async function getPendingProductReviewCount(): Promise<number> {
  const { count, error } = await supabase
    .from('product_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) {
    // Migration 0026 not run yet: no badge rather than an error in the menu.
    if (error.code === '42P01' || error.code === 'PGRST205') return 0
    throw error
  }
  return count ?? 0
}

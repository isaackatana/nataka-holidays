import { supabase } from '@/lib/supabase'
import type { ReviewStatus } from '@/types/domain'

export interface AdminReview {
  id: string
  rating: number
  comment: string | null
  status: ReviewStatus
  created_at: string
  owner_reply: string | null
  review_images: { id: string; storage_path: string }[]
  properties: { title: string; slug: string } | null
  profiles: { full_name: string | null } | null
}

export interface AdminReviewFilters {
  status?: ReviewStatus
}

export async function getAllReviewsForAdmin(filters: AdminReviewFilters = {}): Promise<AdminReview[]> {
  let query = supabase
    .from('reviews')
    .select('id, rating, comment, status, created_at, owner_reply, review_images ( id, storage_path ), properties ( title, slug ), profiles ( full_name )')
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as AdminReview[]
}

export async function updateReviewStatus(id: string, status: ReviewStatus): Promise<void> {
  const { error } = await supabase.from('reviews').update({ status } as never).eq('id', id)
  if (error) throw error
}

export async function deleteReview(id: string): Promise<void> {
  // Photo rows go with the review, but their files don't: clear them first.
  const { data: images } = await supabase.from('review_images').select('storage_path').eq('review_id', id)
  const paths = ((images ?? []) as unknown as { storage_path: string }[]).map((i) => i.storage_path)

  const { error } = await supabase.from('reviews').delete().eq('id', id)
  if (error) throw error

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('review-images').remove(paths)
    if (storageError) console.error('[deleteReview] could not remove photo files:', storageError)
  }
}

export const OWNER_REPLY_MAX = 1000

/** Saves (or, with an empty string, removes) the business's public reply. */
export async function setOwnerReply(id: string, reply: string): Promise<void> {
  const text = reply.trim()
  const { error } = await supabase
    .from('reviews')
    .update({
      owner_reply: text || null,
      owner_replied_at: text ? new Date().toISOString() : null,
    } as never)
    .eq('id', id)
  if (error) throw error
}

/** How many reviews are waiting for approval (cheap: counts rows, loads none). */
export async function getPendingReviewCount(): Promise<number> {
  const { count, error } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) throw error
  return count ?? 0
}

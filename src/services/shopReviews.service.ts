import { supabase } from '@/lib/supabase'

export const PRODUCT_REVIEW_COMMENT_MAX = 1000

export interface ProductReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  owner_reply: string | null
  reviewer_name: string | null
}

/** True when migration 0029 hasn't been run: public pages then show no reviews instead of an error. */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST200'
}

export async function getApprovedProductReviews(productId: string): Promise<ProductReview[]> {
  const { data, error } = await supabase
    .from('product_reviews')
    .select('id, rating, comment, created_at, owner_reply, reviewer_name')
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTable(error)) return []
    throw error
  }
  return (data ?? []) as unknown as ProductReview[]
}

export interface ProductRating {
  product_id: string
  average: number
  review_count: number
}

/** Average rating and review count for every product that has approved reviews (one call). */
export async function getProductRatings(): Promise<Record<string, ProductRating>> {
  const { data, error } = await supabase.rpc('product_rating_stats' as never)
  if (error) throw error
  const rows = (data ?? []) as unknown as { product_id: string; average: number | string; review_count: number }[]
  const map: Record<string, ProductRating> = {}
  for (const row of rows) {
    map[row.product_id] = {
      product_id: row.product_id,
      average: Number(row.average),
      review_count: Number(row.review_count),
    }
  }
  return map
}

export interface MyProductReview {
  id: string
  order_id: string | null
  product_id: string
  rating: number
  comment: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export async function getMyProductReviews(customerId: string): Promise<MyProductReview[]> {
  const { data, error } = await supabase
    .from('product_reviews')
    .select('id, order_id, product_id, rating, comment, status, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTable(error)) return []
    throw error
  }
  return (data ?? []) as unknown as MyProductReview[]
}

export interface SubmitProductReviewInput {
  customerId: string
  productId: string
  orderId: string
  rating: number
  comment: string
}

/** The database forces status = 'pending' and checks it is the guest's own received order. */
export async function submitProductReview(input: SubmitProductReviewInput): Promise<void> {
  const { error } = await supabase.from('product_reviews').insert({
    customer_id: input.customerId,
    product_id: input.productId,
    order_id: input.orderId,
    rating: input.rating,
    comment: input.comment.trim() || null,
  } as never)
  if (error) throw error
}

/** An edit sends the review back to moderation (enforced by the database). */
export async function updateMyProductReview(id: string, rating: number, comment: string): Promise<void> {
  const { error } = await supabase
    .from('product_reviews')
    .update({ rating, comment: comment.trim() || null } as never)
    .eq('id', id)
  if (error) throw error
}

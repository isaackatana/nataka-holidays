import { supabase } from '@/lib/supabase'

export const EXPERIENCE_REVIEW_COMMENT_MAX = 1000

export interface ExperienceReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  owner_reply: string | null
  reviewer_name: string | null
}

/** True when migration 0026 hasn't been run: public pages then show no reviews instead of an error. */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST200'
}

export async function getApprovedExperienceReviews(experienceId: string): Promise<ExperienceReview[]> {
  const { data, error } = await supabase
    .from('experience_reviews')
    .select('id, rating, comment, created_at, owner_reply, reviewer_name')
    .eq('experience_id', experienceId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTable(error)) return []
    throw error
  }
  return (data ?? []) as unknown as ExperienceReview[]
}

export interface ExperienceRating {
  experience_id: string
  average: number
  review_count: number
}

/** Average rating and review count for every experience that has approved reviews (one request). */
export async function getExperienceRatings(): Promise<Record<string, ExperienceRating>> {
  const { data, error } = await supabase.rpc('experience_rating_stats' as never)
  if (error) throw error
  const rows = (data ?? []) as unknown as { experience_id: string; average: number | string; review_count: number }[]
  const map: Record<string, ExperienceRating> = {}
  for (const row of rows) {
    map[row.experience_id] = {
      experience_id: row.experience_id,
      average: Number(row.average),
      review_count: Number(row.review_count),
    }
  }
  return map
}

export interface MyExperienceReview {
  id: string
  request_id: string | null
  experience_id: string
  rating: number
  comment: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export async function getMyExperienceReviews(customerId: string): Promise<MyExperienceReview[]> {
  const { data, error } = await supabase
    .from('experience_reviews')
    .select('id, request_id, experience_id, rating, comment, status, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTable(error)) return []
    throw error
  }
  return (data ?? []) as unknown as MyExperienceReview[]
}

export interface SubmitExperienceReviewInput {
  customerId: string
  experienceId: string
  requestId: string
  rating: number
  comment: string
}

/** The database forces status = 'pending' and checks it is the guest's own completed request. */
export async function submitExperienceReview(input: SubmitExperienceReviewInput): Promise<void> {
  const { error } = await supabase.from('experience_reviews').insert({
    customer_id: input.customerId,
    experience_id: input.experienceId,
    request_id: input.requestId,
    rating: input.rating,
    comment: input.comment.trim() || null,
  } as never)
  if (error) throw error
}

/** An edit sends the review back to moderation (enforced by the database). */
export async function updateMyExperienceReview(id: string, rating: number, comment: string): Promise<void> {
  const { error } = await supabase
    .from('experience_reviews')
    .update({ rating, comment: comment.trim() || null } as never)
    .eq('id', id)
  if (error) throw error
}

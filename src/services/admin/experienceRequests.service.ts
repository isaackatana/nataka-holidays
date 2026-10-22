import { supabase } from '@/lib/supabase'
import type { ExperienceRequestStatus } from '@/services/experienceRequests.service'

export interface AdminExperienceRequest {
  id: string
  experience_id: string | null
  experience_title: string
  guest_name: string
  guest_email: string
  guest_phone: string
  preferred_date: string
  people: number
  message: string | null
  price_type: string | null
  unit_price: number | null
  estimated_total: number | null
  status: ExperienceRequestStatus
  customer_id: string | null
  created_at: string
  /** Migration 0027; absent until it has been run. */
  deposit_percent?: number | null
  agreed_total?: number | null
}

const BASE_REQUEST_COLUMNS =
  'id, experience_id, experience_title, guest_name, guest_email, guest_phone, preferred_date, people, message, price_type, unit_price, estimated_total, status, customer_id, created_at'

export async function getExperienceRequestsForAdmin(
  status?: ExperienceRequestStatus,
): Promise<AdminExperienceRequest[]> {
  const run = (columns: string) => {
    let query = supabase
      .from('experience_requests')
      .select(columns)
      // Newest requests first.
      .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    return query
  }

  let result = await run(`${BASE_REQUEST_COLUMNS}, deposit_percent, agreed_total`)
  // Migration 0027 not run yet: the list still works, just without payment details.
  if (result.error && (result.error.code === '42703' || result.error.code === 'PGRST204')) {
    result = await run(BASE_REQUEST_COLUMNS)
  }
  if (result.error) throw result.error
  return (result.data ?? []) as unknown as AdminExperienceRequest[]
}

export async function updateExperienceRequestStatus(id: string, status: ExperienceRequestStatus): Promise<void> {
  const { error } = await supabase.from('experience_requests').update({ status } as never).eq('id', id)
  if (error) throw error
}

export async function deleteExperienceRequest(id: string): Promise<void> {
  const { error } = await supabase.from('experience_requests').delete().eq('id', id)
  if (error) throw error
}

/** Requests nobody has answered yet (counts rows, loads none). */
export async function getNewExperienceRequestCount(): Promise<number> {
  const { count, error } = await supabase
    .from('experience_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new')
  if (error) {
    // Migration 0025 not run yet: no badge rather than an error in the menu.
    if (error.code === '42P01' || error.code === 'PGRST205') return 0
    throw error
  }
  return count ?? 0
}

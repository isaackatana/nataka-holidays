import { supabase } from '@/lib/supabase'

export interface ExperienceRequestInput {
  /** Created by the caller so the confirmation email can be triggered for this exact request. */
  id: string
  experienceId: string
  /** Only used as a placeholder: the database replaces it with the experience's real title. */
  experienceTitle: string
  guestName: string
  guestEmail: string
  guestPhone: string
  preferredDate: string
  people: number
  message?: string
}

/**
 * Sends a request. The database fills in the title, price and estimated total
 * itself and starts every request as 'new', whatever is sent here.
 */
export async function submitExperienceRequest(input: ExperienceRequestInput): Promise<void> {
  const { error } = await supabase.from('experience_requests').insert({
    id: input.id,
    experience_id: input.experienceId,
    experience_title: input.experienceTitle,
    guest_name: input.guestName.trim(),
    guest_email: input.guestEmail.trim(),
    guest_phone: input.guestPhone.trim(),
    preferred_date: input.preferredDate,
    people: input.people,
    message: input.message?.trim() || null,
  } as never)
  if (error) throw error
}

export type ExperienceRequestStatus = 'new' | 'confirmed' | 'declined' | 'cancelled' | 'completed'

export interface MyExperienceRequest {
  id: string
  experience_id: string | null
  experience_title: string
  preferred_date: string
  people: number
  estimated_total: number | null
  status: ExperienceRequestStatus
  created_at: string
}

/** The signed-in guest's own requests (row-level security limits it to theirs). */
export async function getMyExperienceRequests(customerId: string): Promise<MyExperienceRequest[]> {
  const { data, error } = await supabase
    .from('experience_requests')
    .select('id, experience_id, experience_title, preferred_date, people, estimated_total, status, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    // Migration 0025 not run yet: show nothing rather than an error on My bookings.
    if (error.code === '42P01' || error.code === 'PGRST205') return []
    throw error
  }
  return (data ?? []) as unknown as MyExperienceRequest[]
}

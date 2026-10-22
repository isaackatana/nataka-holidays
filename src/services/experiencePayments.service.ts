import { supabase } from '@/lib/supabase'

export type ExperiencePaymentPhase = 'deposit' | 'balance' | 'paid' | 'unavailable'

/** What the database says is owed on a request (experience_amount_due). */
export interface ExperienceAmountDue {
  payable: boolean
  reason: 'not_found' | 'no_total' | 'not_offered' | 'no_account' | 'not_confirmed' | 'paid' | null
  phase: ExperiencePaymentPhase
  total?: number
  deposit?: number | null
  paid?: number
  due_now?: number
}

export async function getExperienceAmountDue(requestId: string): Promise<ExperienceAmountDue> {
  const { data, error } = await supabase.rpc('experience_amount_due' as never, { p_request_id: requestId } as never)
  if (error) throw error
  return data as unknown as ExperienceAmountDue
}

export interface ExperiencePayment {
  id: string
  request_id: string
  amount: number
  method: 'mpesa' | 'cash' | 'bank' | 'other'
  note: string | null
  status: 'pending' | 'success' | 'failed'
  mpesa_receipt: string | null
  paid_amount: number | null
  created_at: string
}

const PAYMENT_COLUMNS = 'id, request_id, amount, method, note, status, mpesa_receipt, paid_amount, created_at'

/** Payments the signed-in guest can see (row-level security limits it to their own requests). */
export async function getMyExperiencePayments(): Promise<ExperiencePayment[]> {
  const { data, error } = await supabase
    .from('experience_payments')
    .select(PAYMENT_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) {
    // Migration 0027 not run yet: nothing to show rather than an error on My bookings.
    if (error.code === '42P01' || error.code === 'PGRST205') return []
    throw error
  }
  return (data ?? []) as unknown as ExperiencePayment[]
}

/** Asks the server to send an M-Pesa prompt. The amount is what the database says is due. */
export async function payForExperience(input: { requestId: string; phone: string }): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Please sign in again.')

  const res = await fetch('/api/experience-pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Could not send the payment request.')
}

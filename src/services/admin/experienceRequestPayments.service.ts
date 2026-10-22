import { supabase } from '@/lib/supabase'
import type { ExperiencePayment } from '@/services/experiencePayments.service'

/** Every experience payment (admin only; row-level security hides them from everyone else). */
export async function getAllExperiencePayments(): Promise<ExperiencePayment[]> {
  const { data, error } = await supabase
    .from('experience_payments')
    .select('id, request_id, amount, method, note, status, mpesa_receipt, paid_amount, created_at')
    .order('created_at', { ascending: false })
  if (error) {
    // Migration 0027 not run yet: no payments to show.
    if (error.code === '42P01' || error.code === 'PGRST205') return []
    throw error
  }
  return (data ?? []) as unknown as ExperiencePayment[]
}

export interface RecordExperiencePaymentInput {
  requestId: string
  amount: number
  method: 'cash' | 'bank' | 'other'
  note?: string
}

/** Records money received outside an M-Pesa prompt (cash, bank transfer...). */
export async function recordExperiencePayment(input: RecordExperiencePaymentInput): Promise<void> {
  const { error } = await supabase.rpc(
    'admin_record_experience_payment' as never,
    {
      p_request_id: input.requestId,
      p_amount: input.amount,
      p_method: input.method,
      p_note: input.note?.trim() || null,
    } as never,
  )
  if (error) throw new Error(error.message)
}

/** Sets the final price for a request, or clears it (null) to go back to the estimate. */
export async function setAgreedTotal(requestId: string, total: number | null): Promise<void> {
  const { error } = await supabase
    .from('experience_requests')
    .update({ agreed_total: total } as never)
    .eq('id', requestId)
  if (error) throw error
}

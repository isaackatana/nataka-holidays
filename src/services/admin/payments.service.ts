import { supabase } from '@/lib/supabase'
import { manualPaymentTimestamp, type PaymentMethod, type PaymentStatus } from '@/utils/payments'

export interface Payment {
  id: string
  booking_id: string
  amount: number
  phone: string | null
  method: PaymentMethod
  note: string | null
  status: PaymentStatus
  mpesa_receipt: string | null
  result_desc: string | null
  paid_amount: number | null
  created_at: string
}

const PAYMENT_COLUMNS =
  'id, booking_id, amount, phone, method, note, status, mpesa_receipt, result_desc, paid_amount, created_at'

/** Admin: every payment. RLS scopes this, so a customer calling the same
 * query would only ever receive payments on their own bookings. */
export async function getPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Payment[]
}

export interface PaymentRequestInput {
  bookingId: string
  amount: number
  phone: string
}

/** Asks the server to send an M-Pesa prompt to the guest's phone. */
export async function requestPayment(input: PaymentRequestInput): Promise<Payment> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Please sign in again.')

  const res = await fetch('/api/pay-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Could not send the payment request.')
  return body.payment as Payment
}

export interface ManualPaymentInput {
  bookingId: string
  amount: number
  method: Exclude<PaymentMethod, 'mpesa'>
  /** yyyy-mm-dd the money was received. */
  date: string
  note: string
}

/** Admin: record cash / bank / other money received. RLS only allows an
 * admin to insert a non-M-Pesa row, and only as already 'success'. */
export async function recordManualPayment(input: ManualPaymentInput): Promise<void> {
  const { error } = await supabase.from('payments').insert({
    booking_id: input.bookingId,
    amount: input.amount,
    paid_amount: input.amount,
    method: input.method,
    status: 'success',
    note: input.note.trim() || null,
    created_at: manualPaymentTimestamp(input.date),
  } as never)
  if (error) throw error
}

/** Admin: remove a manual payment entered by mistake (M-Pesa rows can't be deleted). */
export async function deleteManualPayment(id: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', id).neq('method', 'mpesa')
  if (error) throw error
}

export type PaymentStatus = 'pending' | 'success' | 'failed'

export interface PaymentLike {
  status: PaymentStatus
  amount: number
  paid_amount: number | null
}

/** Total actually received: only successful payments count, using the
 * amount Safaricom reports as paid (falling back to the requested amount). */
export function sumPaid(payments: PaymentLike[]): number {
  return payments
    .filter((p) => p.status === 'success')
    .reduce((total, p) => total + (p.paid_amount ?? p.amount), 0)
}

export type PaymentMethod = 'mpesa' | 'cash' | 'bank' | 'other'

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  mpesa: 'M-Pesa',
  cash: 'Cash',
  bank: 'Bank transfer',
  other: 'Other',
}

export const MAX_MANUAL_AMOUNT = 10_000_000

/** Why a manually recorded payment can't be saved, or null if it's fine. */
export function manualPaymentError(input: { amount: number; date: string; today: string }): string | null {
  const { amount, date, today } = input
  if (!Number.isInteger(amount) || amount < 1) return 'Enter the amount received as a whole number of shillings.'
  if (amount > MAX_MANUAL_AMOUNT) return 'That amount looks too large. Please check it.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Choose the date the money was received.'
  if (date > today) return "The received date can't be in the future."
  return null
}

/** Stored timestamp for a manual payment: midday East Africa Time on the
 * chosen day, so it lands on that day in every timezone and in the reports. */
export function manualPaymentTimestamp(date: string): string {
  return `${date}T12:00:00+03:00`
}

/** An M-Pesa prompt normally resolves within a minute. Past this, the guest
 * probably dismissed it, or Safaricom's result never reached the site. */
export const STUCK_PAYMENT_MINUTES = 5

export interface StuckCandidate {
  status: PaymentStatus
  method: PaymentMethod
  created_at: string
}

/** M-Pesa payments still "waiting for PIN" after STUCK_PAYMENT_MINUTES.
 * Cash and bank entries never wait, so they are ignored. */
export function findStuckPayments<T extends StuckCandidate>(payments: T[], now: number = Date.now()): T[] {
  const cutoff = now - STUCK_PAYMENT_MINUTES * 60_000
  return payments.filter(
    (p) => p.method === 'mpesa' && p.status === 'pending' && new Date(p.created_at).getTime() <= cutoff,
  )
}

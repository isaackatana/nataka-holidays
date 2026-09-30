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

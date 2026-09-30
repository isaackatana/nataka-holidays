import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useRequestPayment } from '@/features/admin/payments/queries'
import type { Payment } from '@/services/admin/payments.service'
import { formatKES } from '@/utils/currency'
import { sumPaid } from '@/utils/payments'

const STATUS_STYLES: Record<Payment['status'], string> = {
  pending: 'bg-gold-500/15 text-gold-600',
  success: 'bg-palm-green text-sand-50',
  failed: 'bg-coral-500/15 text-coral-500',
}
const STATUS_LABELS: Record<Payment['status'], string> = {
  pending: 'Waiting for PIN',
  success: 'Paid',
  failed: 'Failed',
}

interface Props {
  bookingId: string
  guestPhone: string
  estimatedTotal: number | null
  payments: Payment[]
  canRequest: boolean
}

export function PaymentPanel({ bookingId, guestPhone, estimatedTotal, payments, canRequest }: Props) {
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState(guestPhone)
  const request = useRequestPayment()

  const paid = sumPaid(payments)
  const balance = estimatedTotal !== null ? Math.max(estimatedTotal - paid, 0) : null
  const hasPending = payments.some((p) => p.status === 'pending')

  function fill(value: number) {
    setAmount(String(Math.round(value)))
  }

  function submit() {
    request.mutate({ bookingId, amount: Number(amount), phone })
  }

  return (
    <div className="mt-4 rounded-lg border border-sand-200 bg-sand-50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-teal-900">M-Pesa payments</h3>
        <p className="font-figures text-xs text-charcoal-500">
          Paid {formatKES(paid)}
          {balance !== null && ` · Balance ${formatKES(balance)}`}
        </p>
      </div>

      {payments.length > 0 && (
        <ul className="mt-3 divide-y divide-sand-200 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-figures text-charcoal-900">{formatKES(p.paid_amount ?? p.amount)}</span>
              <span className="text-xs text-charcoal-500">
                {new Date(p.created_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                {p.mpesa_receipt && ` · ${p.mpesa_receipt}`}
                {p.status === 'failed' && p.result_desc && ` · ${p.result_desc}`}
              </span>
              <span
                className={`rounded-pill px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide ${STATUS_STYLES[p.status]}`}
              >
                {STATUS_LABELS[p.status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canRequest && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {estimatedTotal !== null && (
              <>
                <button
                  type="button"
                  onClick={() => fill(estimatedTotal * 0.3)}
                  className="rounded-pill bg-sand-100 px-3 py-1 text-xs font-medium text-charcoal-600 hover:bg-sand-200"
                >
                  30% deposit
                </button>
                {balance !== null && balance > 0 && (
                  <button
                    type="button"
                    onClick={() => fill(balance)}
                    className="rounded-pill bg-sand-100 px-3 py-1 text-xs font-medium text-charcoal-600 hover:bg-sand-200"
                  >
                    Full balance
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1 text-xs text-charcoal-500">
              Amount (KSh)
              <input
                type="number"
                min={1}
                max={250000}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-36 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-charcoal-500">
              Guest's M-Pesa number
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-48 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
              />
            </label>
            <Button type="button" onClick={submit} loading={request.isPending} disabled={!amount || !phone}>
              Send M-Pesa prompt
            </Button>
          </div>

          {request.isError && (
            <p role="alert" className="text-sm text-coral-500">
              {request.error instanceof Error ? request.error.message : 'Something went wrong.'}
            </p>
          )}
          {request.isSuccess && !hasPending && (
            <p className="text-sm text-charcoal-500">Prompt sent. The status updates here automatically.</p>
          )}
          {hasPending && (
            <p className="text-sm text-charcoal-500">Waiting for the guest to enter their M-Pesa PIN…</p>
          )}
        </div>
      )}
    </div>
  )
}

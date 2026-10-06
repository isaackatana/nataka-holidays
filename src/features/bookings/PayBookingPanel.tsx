import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useRequestPayment } from '@/features/admin/payments/queries'
import type { Payment } from '@/services/admin/payments.service'
import { formatKES } from '@/utils/currency'
import { sumPaid } from '@/utils/payments'

interface Props {
  bookingId: string
  guestPhone: string
  estimatedTotal: number
  payments: Payment[]
}

/** Shown to a signed-in guest on a confirmed booking. The server re-checks
 * ownership, status and the amount limit, so this is convenience, not security. */
export function PayBookingPanel({ bookingId, guestPhone, estimatedTotal, payments }: Props) {
  const [phone, setPhone] = useState(guestPhone)
  const [amount, setAmount] = useState<number | null>(null)
  const request = useRequestPayment()

  const paid = sumPaid(payments)
  const balance = Math.max(estimatedTotal - paid, 0)
  const hasPending = payments.some((p) => p.status === 'pending')
  if (balance <= 0) return null

  const deposit = Math.min(Math.round(estimatedTotal * 0.3), balance)
  const options = [
    ...(paid === 0 && deposit < balance ? [{ label: `30% deposit · ${formatKES(deposit)}`, value: deposit }] : []),
    { label: `${paid > 0 ? 'Pay balance' : 'Pay in full'} · ${formatKES(balance)}`, value: balance },
  ]
  const chosen = amount ?? options[0].value

  return (
    <div className="mt-2 rounded-lg border border-sand-200 bg-sand-100/60 p-4">
      <p className="text-sm font-medium text-teal-900">Pay with M-Pesa</p>
      <p className="mt-0.5 text-xs text-charcoal-500">
        We'll send a prompt to your phone. Enter your M-Pesa PIN to confirm.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setAmount(o.value)}
            className={`rounded-pill px-4 py-2.5 text-xs font-medium transition-colors ${
              chosen === o.value ? 'bg-teal-900 text-sand-50' : 'bg-sand-50 text-charcoal-600 hover:bg-sand-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-charcoal-500">
          M-Pesa number
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-48 rounded-lg border border-sand-400 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
          />
        </label>
        <Button
          type="button"
          loading={request.isPending}
          disabled={!phone || hasPending}
          onClick={() => request.mutate({ bookingId, amount: chosen, phone })}
        >
          Send prompt
        </Button>
      </div>

      {request.isError && (
        <p role="alert" className="mt-2 text-sm text-coral-500">
          {request.error instanceof Error ? request.error.message : 'Something went wrong.'}
        </p>
      )}
      {hasPending && (
        <p role="status" className="mt-2 text-sm text-charcoal-500">Check your phone and enter your M-Pesa PIN…</p>
      )}
    </div>
  )
}

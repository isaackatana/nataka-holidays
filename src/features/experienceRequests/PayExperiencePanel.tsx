import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useExperienceAmountDue, usePayForExperience } from '@/features/experienceRequests/paymentQueries'
import type { ExperiencePayment } from '@/services/experiencePayments.service'
import { formatKES } from '@/utils/currency'

interface Props {
  requestId: string
  /** Only a confirmed request can be paid; a completed one just shows what was paid. */
  confirmed: boolean
  defaultPhone: string
  payments: ExperiencePayment[]
}

/**
 * Shown to the signed-in guest on a request we have confirmed. The amount is
 * decided by the database (a deposit first, then the balance): the guest only
 * chooses the phone number. The server re-checks everything.
 */
export function PayExperiencePanel({ requestId, confirmed, defaultPhone, payments }: Props) {
  const [phone, setPhone] = useState(defaultPhone)
  const pay = usePayForExperience()

  // A new key whenever the guest's payments change, so the amount is re-read from the database.
  const paymentsKey = payments.map((p) => `${p.id}:${p.status}`).join(',')
  const { data: due } = useExperienceAmountDue(requestId, true, paymentsKey)
  const hasPending = payments.some((p) => p.status === 'pending')

  if (!due || due.reason === 'not_found') return null

  const paid = due.paid ?? 0
  const total = due.total

  if (due.reason === 'paid') {
    return (
      <p role="status" className="mt-3 w-full rounded-lg bg-palm-green/10 px-4 py-3 text-sm text-palm-green">
        Paid in full{total ? ` (${formatKES(total)})` : ''}. Thank you!
      </p>
    )
  }

  if (!due.payable) {
    const message = !confirmed
      ? null
      : due.reason === 'not_offered'
        ? "We'll share payment details with you directly."
        : due.reason === 'no_total'
          ? "We'll message you the final price."
          : null
    return (
      <div className="mt-3 w-full text-sm text-charcoal-600">
        {paid > 0 && total ? <p>Paid {formatKES(paid)} of {formatKES(total)}.</p> : null}
        {message && <p>{message}</p>}
      </div>
    )
  }

  const dueNow = due.due_now ?? 0
  const label = due.phase === 'deposit' ? 'Pay deposit' : 'Pay balance'

  return (
    <div className="mt-3 w-full rounded-lg border border-sand-200 bg-sand-100/60 p-4">
      <p className="text-sm font-medium text-teal-900">Pay with M-Pesa</p>
      <p className="mt-0.5 text-xs text-charcoal-500">
        {total ? `Total ${formatKES(total)}` : ''}
        {paid > 0 ? ` · paid ${formatKES(paid)}` : ''}
        {due.phase === 'deposit' && due.deposit ? ` · deposit ${formatKES(due.deposit)}` : ''}. We'll send a prompt to
        your phone; enter your M-Pesa PIN to confirm.
      </p>

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
          loading={pay.isPending}
          disabled={!phone || hasPending}
          onClick={() => pay.mutate({ requestId, phone })}
        >
          {label} · {formatKES(dueNow)}
        </Button>
      </div>

      {pay.isError && (
        <p role="alert" className="mt-2 text-sm text-coral-500">
          {pay.error instanceof Error ? pay.error.message : 'Something went wrong.'}
        </p>
      )}
      {hasPending && (
        <p role="status" className="mt-2 text-sm text-charcoal-500">
          Check your phone and enter your M-Pesa PIN…
        </p>
      )}
    </div>
  )
}

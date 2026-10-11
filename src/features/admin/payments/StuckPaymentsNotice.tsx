import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { usePayments } from '@/features/admin/payments/queries'
import { STUCK_PAYMENT_MINUTES, findStuckPayments } from '@/utils/payments'

/** Dashboard heads-up for M-Pesa prompts stuck on "waiting for PIN".
 * Renders nothing when everything is fine. */
export function StuckPaymentsNotice() {
  const { data: payments } = usePayments()
  const stuck = findStuckPayments(payments ?? [])
  if (stuck.length === 0) return null

  const count = stuck.length
  return (
    <div role="alert" className="mt-6 flex items-start gap-3 rounded-card bg-gold-500/15 px-5 py-4 text-sm text-charcoal-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
      <div>
        <p className="font-medium">
          {count === 1 ? '1 M-Pesa payment needs' : `${count} M-Pesa payments need`} your attention
        </p>
        <p className="mt-1 text-charcoal-700">
          {count === 1 ? 'It has' : 'They have'} been waiting for a PIN for over {STUCK_PAYMENT_MINUTES} minutes.
          Check your M-Pesa statement, then{' '}
          <Link to="/admin/bookings" className="font-medium text-teal-800 underline hover:text-teal-900">
            review {count === 1 ? 'it' : 'them'} in Bookings
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

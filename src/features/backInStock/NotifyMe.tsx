import { Link } from 'react-router-dom'
import { Bell, BellOff } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useCancelBackInStock, useMyBackInStock, useRequestBackInStock } from '@/features/backInStock/queries'

interface NotifyMeProps {
  productId: string
  variantId: string | null
  /** What is sold out, for the wording: "Blue" or "this product". */
  what: string
  /** Where to come back to after signing in. */
  returnTo: string
}

/** "Email me when it's back" for a sold-out product or colour. Needs a signed-in guest (we use their account email). */
export function NotifyMe({ productId, variantId, what, returnTo }: NotifyMeProps) {
  const { user } = useAuth()
  if (!user) {
    return (
      <p className="text-sm text-charcoal-600">
        <Link to="/login" state={{ redirectTo: returnTo }} className="font-medium text-teal-800 underline">
          Sign in
        </Link>{' '}
        to get an email when {what} is back in stock.
      </p>
    )
  }
  return <NotifyMeSignedIn customerId={user.id} productId={productId} variantId={variantId} what={what} />
}

function NotifyMeSignedIn({ customerId, productId, variantId, what }: { customerId: string; productId: string; variantId: string | null; what: string }) {
  const { data: mine } = useMyBackInStock(customerId)
  const request = useRequestBackInStock(customerId)
  const cancel = useCancelBackInStock()
  const waiting = mine?.find((r) => r.product_id === productId && (r.variant_id ?? null) === variantId)
  const error = (request.error ?? cancel.error) as Error | null

  return (
    <div className="flex flex-col gap-2">
      {waiting ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-teal-900/10 px-4 py-2.5 text-sm text-teal-900">
          <span className="flex items-center gap-2"><Bell className="h-4 w-4" aria-hidden="true" /> We'll email you when {what} is back.</span>
          <button type="button" disabled={cancel.isPending} onClick={() => cancel.mutate(waiting.id)} className="flex items-center gap-1 underline disabled:opacity-60">
            <BellOff className="h-3.5 w-3.5" aria-hidden="true" /> Stop
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={request.isPending}
          onClick={() => request.mutate({ productId, variantId })}
          className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-teal-900 px-5 py-2.5 text-sm font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50 disabled:opacity-60"
        >
          <Bell className="h-4 w-4" aria-hidden="true" /> Email me when it's back
        </button>
      )}
      {error && <p role="alert" className="text-sm text-coral-500">{error.message}</p>}
    </div>
  )
}

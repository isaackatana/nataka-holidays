import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'
import { useCancelMyOrder, useMyOrders, usePayForOrder } from '@/features/shop/queries'
import { useMyProductReviews } from '@/features/productReviews/queries'
import { ReviewProductPanel } from '@/features/productReviews/ReviewProductPanel'
import type { MyProductReview } from '@/services/shopReviews.service'
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES, isAwaitingPayment } from '@/features/shop/orderStatus'
import { formatKES } from '@/utils/currency'
import type { Order } from '@/types/domain'

function PayPanel({ order, autoSent }: { order: Order; autoSent: boolean }) {
  const [phone, setPhone] = useState(order.customer_phone)
  const pay = usePayForOrder()
  const cancel = useCancelMyOrder()
  const hasPending = order.order_payments?.some((p) => p.status === 'pending' && Date.now() - new Date(p.created_at).getTime() < 3 * 60_000)
  const lastFailed = order.order_payments?.some((p) => p.status === 'failed')
  const until = new Date(order.expires_at).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="mt-3 rounded-lg border border-sand-200 bg-sand-100/60 p-4">
      {hasPending || (autoSent && !lastFailed && !pay.isError) ? (
        <p role="status" className="text-sm text-charcoal-700">Check your phone and enter your M-Pesa PIN. This page updates by itself once we receive your payment.</p>
      ) : (
        <p className="text-sm text-charcoal-700">{lastFailed ? 'That payment did not go through. You can try again.' : 'Pay for this order with M-Pesa.'}</p>
      )}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-charcoal-500">
          M-Pesa number
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-48 rounded-lg border border-sand-400 bg-sand-50 px-3 py-2 text-base text-charcoal-900 outline-none focus:border-teal-700 sm:text-sm" />
        </label>
        <Button type="button" loading={pay.isPending} disabled={!phone} onClick={() => pay.mutate({ orderId: order.id, phone })}>
          {hasPending ? 'Send the prompt again' : 'Send M-Pesa prompt'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={cancel.isPending}
          onClick={() => { if (window.confirm('Cancel this order?')) cancel.mutate(order.id) }}
        >
          Cancel order
        </Button>
      </div>
      {pay.isError && <p role="alert" className="mt-2 text-sm text-coral-500">{pay.error instanceof Error ? pay.error.message : 'Something went wrong.'}</p>}
      {cancel.isError && <p role="alert" className="mt-2 text-sm text-coral-500">{cancel.error instanceof Error ? cancel.error.message : 'Could not cancel.'}</p>}
      <p className="mt-2 text-xs text-charcoal-500">We're holding your items until {until}.</p>
    </div>
  )
}

/** One review box per distinct product in an order the guest has received. */
function OrderReviews({ order, customerId, reviews }: { order: Order; customerId: string; reviews: MyProductReview[] }) {
  const seen = new Set<string>()
  const items = (order.order_items ?? []).filter((i) => {
    if (!i.product_id || seen.has(i.product_id)) return false
    seen.add(i.product_id)
    return true
  })
  if (items.length === 0) return null
  return (
    <div className="mt-3 flex flex-col gap-3">
      {items.map((i) => (
        <div key={i.id}>
          <p className="text-sm font-medium text-teal-900">Review {i.product_name.replace(/ \(.*\)$/, '')}</p>
          <ReviewProductPanel
            customerId={customerId}
            productId={i.product_id as string}
            orderId={order.id}
            review={reviews.find((r) => r.product_id === i.product_id)}
          />
        </div>
      ))}
    </div>
  )
}

export default function MyOrders() {
  const { user } = useAuth()
  const location = useLocation()
  const justPlaced = (location.state as { justPlaced?: string } | null)?.justPlaced
  const { data: orders, isLoading, isError } = useMyOrders(user?.id)
  const { data: myReviews } = useMyProductReviews(user?.id)

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <SEO title="My Orders" description="Your Nataka Holidays shop orders." noindex />
      <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">My orders</h1>
      <p className="mt-2 text-charcoal-500">What you've ordered from the shop, and where it stands.</p>

      {isError && <p className="mt-8 rounded-card bg-coral-500/10 p-6 text-sm text-coral-500">Something went wrong loading your orders. Please try again.</p>}

      {!isError && (
        <div className="mt-8 flex flex-col gap-4">
          {isLoading && Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-card bg-sand-200" />)}

          {!isLoading && orders?.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-card bg-sand-100 py-16 text-center">
              <ShoppingBag className="h-10 w-10 text-sand-300" aria-hidden="true" />
              <p className="text-charcoal-500">You haven't ordered anything yet.</p>
              <Link to="/shop" className="rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800">Browse the shop</Link>
            </div>
          )}

          {orders?.map((o) => (
            <article key={o.id} className="rounded-card bg-sand-50 p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-charcoal-500">
                  {new Date(o.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <span className={`inline-flex rounded-pill px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${ORDER_STATUS_STYLES[o.status]}`}>
                  {ORDER_STATUS_LABELS[o.status]}
                </span>
              </div>
              <ul className="mt-3 text-sm text-charcoal-700">
                {o.order_items?.map((i) => (
                  <li key={i.id} className="flex justify-between py-0.5">
                    <span>{i.quantity} × {i.product_name}</span>
                    <span className="font-figures">{formatKES(i.unit_price * i.quantity)}</span>
                  </li>
                ))}
                {o.discount_amount > 0 && <li className="flex justify-between py-0.5"><span>Discount ({o.discount_code})</span><span className="font-figures">−{formatKES(o.discount_amount)}</span></li>}
                {o.delivery_fee > 0 && <li className="flex justify-between py-0.5"><span>Delivery</span><span className="font-figures">{formatKES(o.delivery_fee)}</span></li>}
              </ul>
              <p className="mt-2 flex justify-between border-t border-sand-200 pt-2 font-medium text-teal-900">
                <span>Total</span><span className="font-figures">{formatKES(o.total)}</span>
              </p>
              <p className="mt-2 text-xs text-charcoal-500">
                {o.fulfilment === 'delivery' ? `Delivery to: ${o.delivery_address}` : `Hand-over at: ${o.handover_note}`}
              </p>
              {isAwaitingPayment(o) && <PayPanel order={o} autoSent={justPlaced === o.id} />}
              {o.status === 'completed' && user && <OrderReviews order={o} customerId={user.id} reviews={myReviews ?? []} />}
              {o.status === 'expired' && <p className="mt-3 text-sm text-charcoal-500">This order wasn't paid in time, so the items were released. You're welcome to order again.</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

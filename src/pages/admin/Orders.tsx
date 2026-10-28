import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { useAdminOrders, useMarkOrderPaid, useSetOrderStatus } from '@/features/admin/shop/queries'
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from '@/features/shop/orderStatus'
import { formatKES } from '@/utils/currency'
import type { Order } from '@/types/domain'

type Filter = 'action' | 'all'
const ACTIVE = new Set(['pending_payment', 'paid', 'packed'])

function OrderCard({ order }: { order: Order }) {
  const setStatus = useSetOrderStatus()
  const markPaid = useMarkOrderPaid()
  const error = (setStatus.error ?? markPaid.error) as Error | null

  function cancel() {
    const refund = order.status === 'paid' || order.status === 'packed'
    const msg = refund
      ? 'Cancel this PAID order? The items go back in stock. You must refund the customer yourself on M-Pesa.'
      : 'Cancel this order? The items go back in stock.'
    if (window.confirm(msg)) setStatus.mutate({ orderId: order.id, status: 'cancelled' })
  }

  return (
    <article className="rounded-card border border-sand-200 bg-sand-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-charcoal-900">{order.customer_name}</p>
          <p className="text-sm text-charcoal-500">
            <a href={`tel:+${order.customer_phone}`} className="underline">{order.customer_phone}</a>
            {' · '}
            {new Date(order.created_at).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <span className={`inline-flex rounded-pill px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${ORDER_STATUS_STYLES[order.status]}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <ul className="mt-3 text-sm text-charcoal-700">
        {order.order_items?.map((i) => (
          <li key={i.id} className="flex justify-between py-0.5">
            <span>{i.quantity} × {i.product_name}</span>
            <span className="font-figures">{formatKES(i.unit_price * i.quantity)}</span>
          </li>
        ))}
        {order.discount_amount > 0 && <li className="flex justify-between py-0.5"><span>Discount ({order.discount_code})</span><span className="font-figures">−{formatKES(order.discount_amount)}</span></li>}
                {order.gift_wrap && <li className="flex justify-between py-0.5"><span>Gift wrap</span><span className="font-figures">{formatKES(order.gift_wrap_fee)}</span></li>}
                {order.delivery_fee > 0 && <li className="flex justify-between py-0.5"><span>Delivery</span><span className="font-figures">{formatKES(order.delivery_fee)}</span></li>}
      </ul>
      <p className="mt-2 flex justify-between border-t border-sand-200 pt-2 font-medium text-teal-900"><span>Total</span><span className="font-figures">{formatKES(order.total)}</span></p>

      <p className="mt-3 text-sm text-charcoal-700">
        <strong>{order.fulfilment === 'delivery' ? 'Deliver to:' : 'Hand over at:'}</strong>{' '}
        {order.fulfilment === 'delivery' ? order.delivery_address : order.handover_note}
      </p>
      {order.admin_note && <p role="note" className="mt-2 rounded-lg bg-gold-500/15 px-3 py-2 text-sm text-charcoal-900">{order.admin_note}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {order.status === 'pending_payment' && (
          <button type="button" disabled={markPaid.isPending} onClick={() => { if (window.confirm('Mark this order as paid in cash?')) markPaid.mutate({ orderId: order.id, via: 'cash' }) }} className="rounded-full bg-teal-900 px-4 py-2 text-xs font-medium text-sand-50 hover:bg-teal-800 disabled:opacity-60">Paid in cash</button>
        )}
        {(order.status === 'paid' || order.status === 'packed') && (
          <Link to={`/admin/orders/print?ids=${order.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-teal-900 px-4 py-2 text-xs font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50">
            <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Packing slip
          </Link>
        )}
        {order.status === 'paid' && (
          <button type="button" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ orderId: order.id, status: 'packed' })} className="rounded-full bg-teal-900 px-4 py-2 text-xs font-medium text-sand-50 hover:bg-teal-800 disabled:opacity-60">Mark packed</button>
        )}
        {(order.status === 'paid' || order.status === 'packed') && (
          <button type="button" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ orderId: order.id, status: 'completed' })} className="rounded-full bg-teal-900 px-4 py-2 text-xs font-medium text-sand-50 hover:bg-teal-800 disabled:opacity-60">
            {order.fulfilment === 'delivery' ? 'Mark delivered' : 'Mark handed over'}
          </button>
        )}
        {ACTIVE.has(order.status) && (
          <button type="button" disabled={setStatus.isPending} onClick={cancel} className="rounded-full border border-coral-500 px-4 py-2 text-xs font-medium text-coral-500 hover:bg-coral-500/10 disabled:opacity-60">Cancel order</button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-coral-500">{error.message}</p>}
    </article>
  )
}

export default function AdminOrders() {
  const { data: orders, isLoading, isError } = useAdminOrders()
  const [filter, setFilter] = useState<Filter>('action')
  const shown = (orders ?? []).filter((o) => filter === 'all' || ACTIVE.has(o.status))
  const toPack = (orders ?? []).filter((o) => o.status === 'paid').length

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-2xl font-medium text-teal-900">Shop orders</h1>
      <p className="mt-1 text-sm text-charcoal-500">
        {toPack > 0 ? `${toPack} paid order${toPack === 1 ? '' : 's'} waiting to be packed.` : 'Nothing waiting to be packed.'}
      </p>
      {toPack > 0 && (
        <Link to="/admin/orders/print" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-900 px-4 py-2 text-xs font-medium text-sand-50 hover:bg-teal-800">
          <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Print all {toPack} packing slip{toPack === 1 ? '' : 's'}
        </Link>
      )}

      <div className="mt-4 flex gap-2" role="group" aria-label="Filter orders">
        {([['action', 'Open orders'], ['all', 'All orders']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-pill px-4 py-2 text-xs font-medium ${filter === value ? 'bg-teal-900 text-sand-50' : 'bg-sand-100 text-charcoal-600 hover:bg-sand-200'}`}>{label}</button>
        ))}
      </div>

      {isError && <p className="mt-6 rounded-card bg-coral-500/10 p-4 text-sm text-coral-500">Could not load orders.</p>}
      <div className="mt-6 flex flex-col gap-4">
        {isLoading && Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-card bg-sand-200" />)}
        {!isLoading && shown.length === 0 && <p className="rounded-card bg-sand-100 py-12 text-center text-charcoal-500">No orders here yet.</p>}
        {shown.map((o) => <OrderCard key={o.id} order={o} />)}
      </div>
    </div>
  )
}

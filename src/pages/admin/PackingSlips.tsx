import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAdminOrders } from '@/features/admin/shop/queries'
import { orderRef, slipOrders } from '@/features/admin/shop/slips'
import { useBusinessSettings } from '@/features/settings/queries'
import { ORDER_STATUS_LABELS } from '@/features/shop/orderStatus'
import { formatKES } from '@/utils/currency'
import type { Order } from '@/types/domain'

function Slip({ order, business }: { order: Order; business: { name: string; phone: string | null } }) {
  const delivery = order.fulfilment === 'delivery'
  const paid = order.status !== 'pending_payment' && order.status !== 'cancelled' && order.status !== 'expired'
  return (
    <article className="break-after-page rounded-card border border-sand-300 bg-white p-8 text-charcoal-900 print:rounded-none print:border-0 print:p-0">
      <header className="flex items-start justify-between gap-4 border-b border-charcoal-900 pb-4">
        <div>
          <p className="font-display text-2xl font-medium">{business.name}</p>
          <p className="text-sm text-charcoal-600">Packing slip</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono text-lg font-medium">#{orderRef(order)}</p>
          <p className="text-charcoal-600">
            {new Date(order.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </header>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-wide text-charcoal-500">Customer</h2>
          <p className="mt-1 text-lg font-medium">{order.customer_name}</p>
          <p className="text-sm">{order.customer_phone}</p>
        </div>
        <div>
          <h2 className="font-mono text-xs uppercase tracking-wide text-charcoal-500">{delivery ? 'Deliver to' : 'Hand over at'}</h2>
          <p className="mt-1 whitespace-pre-line text-lg font-medium">{delivery ? order.delivery_address : order.handover_note}</p>
          <p className="text-sm text-charcoal-600">{delivery ? 'Delivery' : 'Hand-over during their stay'}</p>
        </div>
      </section>

      <table className="mt-6 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-charcoal-900 font-mono text-xs uppercase tracking-wide text-charcoal-500">
            <th className="w-10 py-2 font-normal"><span className="sr-only">Packed</span></th>
            <th className="w-16 py-2 font-normal">Qty</th>
            <th className="py-2 font-normal">Item</th>
          </tr>
        </thead>
        <tbody>
          {(order.order_items ?? []).map((i) => (
            <tr key={i.id} className="border-b border-sand-300">
              <td className="py-3"><span aria-hidden="true" className="inline-block h-5 w-5 border-2 border-charcoal-900" /></td>
              <td className="py-3 font-figures text-xl font-medium">{i.quantity}</td>
              <td className="py-3 text-lg">{i.product_name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {order.admin_note && (
        <p className="mt-5 border border-charcoal-900 p-3 text-sm"><strong>Note:</strong> {order.admin_note}</p>
      )}

      <footer className="mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-sand-300 pt-4 text-sm">
        <p>
          {paid ? 'Paid' : ORDER_STATUS_LABELS[order.status]}: <span className="font-figures font-medium">{formatKES(order.total)}</span>
          {order.discount_amount > 0 && <span className="text-charcoal-600"> (includes {formatKES(order.discount_amount)} discount)</span>}
        </p>
        <p className="text-charcoal-600">
          Thank you for shopping with {business.name}.{business.phone ? ` Questions? ${business.phone}` : ''}
        </p>
      </footer>
    </article>
  )
}

/** Printable packing slips: one order (?ids=…) or every paid order waiting to be packed. */
export default function AdminPackingSlips() {
  const [params] = useSearchParams()
  const ids = params.get('ids')?.split(',').filter(Boolean) ?? null
  const { data: orders, isLoading, isError } = useAdminOrders()
  const { data: settings } = useBusinessSettings()
  const slips = slipOrders(orders ?? [], ids)
  const business = { name: settings?.business_name ?? 'Nataka Holidays', phone: settings?.contact_phone ?? null }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 print:p-0">
      <div className="admin-chrome flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/orders" className="flex items-center gap-1.5 text-sm text-charcoal-500 hover:text-teal-800">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to orders
        </Link>
        <Button type="button" disabled={slips.length === 0} onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" /> Print {slips.length > 1 ? `${slips.length} slips` : 'slip'}
        </Button>
      </div>

      {isLoading && <p className="admin-chrome mt-6 text-charcoal-500">Loading...</p>}
      {isError && <p className="admin-chrome mt-6 text-sm text-coral-500">Could not load orders.</p>}
      {!isLoading && !isError && slips.length === 0 && (
        <p className="admin-chrome mt-6 rounded-card bg-sand-100 py-12 text-center text-charcoal-500">
          {ids ? 'That order could not be found.' : 'No paid orders are waiting to be packed.'}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6 print:mt-0 print:gap-0">
        {slips.map((o) => <Slip key={o.id} order={o} business={business} />)}
      </div>
    </div>
  )
}

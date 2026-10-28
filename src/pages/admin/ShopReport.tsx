import { useMemo, useState } from 'react'
import { Banknote, Download, Percent, Receipt, ShoppingBag } from 'lucide-react'
import { StatCard } from '@/components/admin/StatCard'
import { useSalesOrders } from '@/features/admin/shop/queries'
import {
  buildShopReport, changeLabel, monthLabel, monthRange, ordersToCsv, previousMonth, recentMonths,
} from '@/features/admin/shop/report'
import { formatKES } from '@/utils/currency'

export default function AdminShopReport() {
  const months = useMemo(() => recentMonths(12), [])
  const [month, setMonth] = useState(months[0])
  const range = useMemo(() => monthRange(month), [month])
  const before = useMemo(() => monthRange(previousMonth(month)), [month])

  const { data: orders, isLoading, isError } = useSalesOrders(range.from, range.to)
  const { data: lastMonthOrders } = useSalesOrders(before.from, before.to)

  const report = useMemo(() => buildShopReport(orders ?? []), [orders])
  const lastRevenue = useMemo(() => buildShopReport(lastMonthOrders ?? []).revenue, [lastMonthOrders])
  const change = lastMonthOrders ? changeLabel(report.revenue, lastRevenue) : null

  function downloadCsv() {
    // The leading byte-order mark makes Excel read the accents and symbols correctly.
    const blob = new Blob(['\uFEFF' + ordersToCsv(orders ?? [])], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nataka-shop-sales-${month}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-medium text-teal-900">Shop sales</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="report-month" className="sr-only">Month</label>
          <select
            id="report-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-sand-400 bg-sand-50 px-3 py-2.5 text-base text-charcoal-900 outline-none focus:border-teal-700 sm:text-sm"
          >
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!orders || orders.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-900 px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-charcoal-500">
        Counts orders that were paid in {monthLabel(month)} (East Africa Time). Cancelled and unpaid orders are left out. If you refunded a paid
        order, cancel it so it leaves this report.
      </p>

      {isError && <p className="mt-6 rounded-card bg-coral-500/10 p-4 text-sm text-coral-500">Could not load the report.</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Money paid" value={report.revenue} icon={Banknote} loading={isLoading} format={formatKES} />
        <StatCard label="Orders" value={report.orders} icon={Receipt} loading={isLoading} />
        <StatCard label="Items sold" value={report.itemsSold} icon={ShoppingBag} loading={isLoading} />
        <StatCard label="Average order" value={report.averageOrder} icon={Percent} loading={isLoading} format={formatKES} />
      </div>
      {change && <p className="mt-3 text-sm text-charcoal-600">Money paid is <strong>{change}</strong> compared with {monthLabel(previousMonth(month))}.</p>}

      {!isLoading && !isError && report.orders === 0 && (
        <p className="mt-6 rounded-card bg-sand-100 py-12 text-center text-charcoal-500">No paid shop orders in {monthLabel(month)}.</p>
      )}

      {report.orders > 0 && (
        <>
          <section className="mt-8" aria-labelledby="where-money-heading">
            <h2 id="where-money-heading" className="font-display text-lg font-medium text-teal-900">Where the money comes from</h2>
            <dl className="mt-3 max-w-md rounded-card border border-sand-200 bg-sand-50 p-5 text-sm">
              <div className="flex justify-between py-1"><dt className="text-charcoal-600">Items at full price</dt><dd className="font-figures">{formatKES(report.itemsGross)}</dd></div>
              <div className="flex justify-between py-1"><dt className="text-charcoal-600">Discounts given</dt><dd className="font-figures">−{formatKES(report.discounts)}</dd></div>
              <div className="flex justify-between py-1"><dt className="text-charcoal-600">Delivery fees</dt><dd className="font-figures">+{formatKES(report.deliveryFees)}</dd></div>
              {report.giftWrapFees > 0 && <div className="flex justify-between py-1"><dt className="text-charcoal-600">Gift wrap</dt><dd className="font-figures">+{formatKES(report.giftWrapFees)}</dd></div>}
              <div className="mt-1 flex justify-between border-t border-sand-300 pt-2 font-medium text-teal-900"><dt>Money paid</dt><dd className="font-figures">{formatKES(report.revenue)}</dd></div>
              <p className="mt-3 text-xs text-charcoal-500">{report.handover} hand-over · {report.delivery} delivery</p>
            </dl>
          </section>

          <section className="mt-8" aria-labelledby="top-products-heading">
            <h2 id="top-products-heading" className="font-display text-lg font-medium text-teal-900">Products</h2>
            <div className="mt-3 overflow-x-auto rounded-card border border-sand-200 bg-sand-50">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-sand-100 text-xs uppercase tracking-wide text-charcoal-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Product</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Sold</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Sales (before discounts)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p) => (
                    <tr key={p.key} className="border-t border-sand-200">
                      <td className="px-4 py-3 font-medium text-charcoal-900">{p.name}</td>
                      <td className="px-4 py-3 text-right font-figures">{p.quantity}</td>
                      <td className="px-4 py-3 text-right font-figures">{formatKES(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {report.discountUse.length > 0 && (
            <section className="mt-8" aria-labelledby="codes-heading">
              <h2 id="codes-heading" className="font-display text-lg font-medium text-teal-900">Discount codes used</h2>
              <div className="mt-3 overflow-x-auto rounded-card border border-sand-200 bg-sand-50">
                <table className="w-full min-w-[360px] text-left text-sm">
                  <thead className="bg-sand-100 text-xs uppercase tracking-wide text-charcoal-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Code</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Orders</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Given off</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.discountUse.map((d) => (
                      <tr key={d.code} className="border-t border-sand-200">
                        <td className="px-4 py-3 font-mono text-charcoal-900">{d.code}</td>
                        <td className="px-4 py-3 text-right font-figures">{d.orders}</td>
                        <td className="px-4 py-3 text-right font-figures">{formatKES(d.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

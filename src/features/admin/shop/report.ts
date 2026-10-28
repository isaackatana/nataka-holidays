// Shop sales report: pure functions (no React, no network) so the numbers
// are easy to test. "Sales" are orders that were paid (including ones since
// packed or handed over); cancelled and expired orders never count.
import { orderRef } from '@/features/admin/shop/slips'
import type { Order } from '@/types/domain'

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000

/** Month (yyyy-mm) a timestamp falls in, in East Africa Time where the business operates. */
export function monthOf(iso: string): string {
  return new Date(new Date(iso).getTime() + EAT_OFFSET_MS).toISOString().slice(0, 7)
}

/** The current month in East Africa Time. */
export function currentMonth(now = Date.now()): string {
  return new Date(now + EAT_OFFSET_MS).toISOString().slice(0, 7)
}

/** [from, to) in UTC for a yyyy-mm month in East Africa Time. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1) - EAT_OFFSET_MS)
  const end = new Date(Date.UTC(y, m, 1) - EAT_OFFSET_MS)
  return { from: start.toISOString(), to: end.toISOString() }
}

export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return d.toISOString().slice(0, 7)
}

/** The last `count` months, newest first, starting from the current one. */
export function recentMonths(count = 12, now = Date.now()): string[] {
  const out: string[] = []
  let m = currentMonth(now)
  for (let i = 0; i < count; i++) {
    out.push(m)
    m = previousMonth(m)
  }
  return out
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-KE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export interface ProductSales {
  key: string
  name: string
  quantity: number
  revenue: number
}

export interface DiscountUse {
  code: string
  orders: number
  amount: number
}

export interface ShopReport {
  orders: number
  /** Money actually paid: items minus discounts plus delivery fees. */
  revenue: number
  itemsSold: number
  /** Items at full price, before any discount. */
  itemsGross: number
  discounts: number
  deliveryFees: number
  giftWrapFees: number
  averageOrder: number
  handover: number
  delivery: number
  topProducts: ProductSales[]
  discountUse: DiscountUse[]
}

/** The product's own name: the colour that the database adds to an order line is taken off. */
export function baseProductName(item: { product_name: string; variant_name?: string | null }): string {
  const suffix = item.variant_name ? ` (${item.variant_name})` : ''
  return suffix && item.product_name.endsWith(suffix) ? item.product_name.slice(0, -suffix.length) : item.product_name
}

export function buildShopReport(orders: Order[]): ShopReport {
  const products = new Map<string, ProductSales>()
  const codes = new Map<string, DiscountUse>()
  let revenue = 0
  let itemsSold = 0
  let itemsGross = 0
  let discounts = 0
  let deliveryFees = 0
  let giftWrapFees = 0
  let handover = 0
  let delivery = 0

  for (const o of orders) {
    revenue += o.total
    discounts += o.discount_amount
    deliveryFees += o.delivery_fee
    giftWrapFees += o.gift_wrap_fee ?? 0
    if (o.fulfilment === 'delivery') delivery += 1
    else handover += 1

    if (o.discount_code && o.discount_amount > 0) {
      const c = codes.get(o.discount_code) ?? { code: o.discount_code, orders: 0, amount: 0 }
      c.orders += 1
      c.amount += o.discount_amount
      codes.set(o.discount_code, c)
    }

    for (const i of o.order_items ?? []) {
      const gross = i.unit_price * i.quantity
      itemsSold += i.quantity
      itemsGross += gross
      const name = baseProductName(i)
      const key = i.product_id ?? `name:${name}`
      const p = products.get(key) ?? { key, name, quantity: 0, revenue: 0 }
      p.quantity += i.quantity
      p.revenue += gross
      products.set(key, p)
    }
  }

  return {
    orders: orders.length,
    revenue,
    itemsSold,
    itemsGross,
    discounts,
    deliveryFees,
    giftWrapFees,
    averageOrder: orders.length ? Math.round(revenue / orders.length) : 0,
    handover,
    delivery,
    topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity || a.name.localeCompare(b.name)),
    discountUse: [...codes.values()].sort((a, b) => b.amount - a.amount || a.code.localeCompare(b.code)),
  }
}

/** "+12%", "-5%", "no change", or null when there is nothing to compare with. */
export function changeLabel(current: number, previous: number): string | null {
  if (previous <= 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return 'no change'
  return `${pct > 0 ? '+' : ''}${pct}%`
}

function csvCell(value: string | number): string {
  const text = String(value)
  // A leading = + - @ can be run as a formula by spreadsheet programs; a leading apostrophe stops that.
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value === 'string' ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export const CSV_HEADER = [
  'Order', 'Paid on (EAT)', 'Customer', 'Phone', 'Hand-over or delivery', 'Items', 'Items total (KSh)',
  'Discount code', 'Discount (KSh)', 'Delivery fee (KSh)', 'Gift wrap (KSh)', 'Total paid (KSh)', 'Status',
]

export function ordersToCsv(orders: Order[]): string {
  const rows = orders.map((o) => [
    orderRef(o),
    new Date(new Date(o.paid_at ?? o.created_at).getTime() + EAT_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' '),
    o.customer_name,
    o.customer_phone,
    o.fulfilment === 'delivery' ? 'Delivery' : 'Hand-over',
    (o.order_items ?? []).map((i) => `${i.quantity} x ${i.product_name}`).join('; '),
    o.subtotal,
    o.discount_code ?? '',
    o.discount_amount,
    o.delivery_fee,
    o.gift_wrap_fee ?? 0,
    o.total,
    o.status,
  ])
  return [CSV_HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

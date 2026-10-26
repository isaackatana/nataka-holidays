import type { Order } from '@/types/domain'

/** Short reference printed on a slip and quoted to guests, e.g. "3F9A2C1B". */
export function orderRef(order: Pick<Order, 'id'>): string {
  return order.id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

/**
 * Which orders a packing-slip page prints. With ids (a single order, or a
 * chosen few) it prints exactly those, in that order, skipping any that do
 * not exist. With no ids it prints every PAID order still waiting to be
 * packed, oldest first, so the oldest order is packed first.
 */
export function slipOrders(orders: Order[], ids: string[] | null): Order[] {
  if (ids && ids.length > 0) {
    const byId = new Map(orders.map((o) => [o.id, o]))
    return ids.flatMap((id) => {
      const o = byId.get(id)
      return o ? [o] : []
    })
  }
  return orders.filter((o) => o.status === 'paid').sort((a, b) => a.created_at.localeCompare(b.created_at))
}

import type { Order, OrderStatus } from '@/types/domain'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  packed: 'Packed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending_payment: 'bg-gold-500/15 text-gold-600',
  paid: 'bg-teal-600/15 text-teal-700',
  packed: 'bg-teal-600/15 text-teal-700',
  completed: 'bg-palm-green text-sand-50',
  cancelled: 'bg-coral-500/15 text-coral-500',
  expired: 'bg-charcoal-500/10 text-charcoal-500',
}

/** Still open for payment: waiting, and not past its hold time. */
export function isAwaitingPayment(order: Pick<Order, 'status' | 'expires_at'>, now = Date.now()): boolean {
  return order.status === 'pending_payment' && new Date(order.expires_at).getTime() > now
}

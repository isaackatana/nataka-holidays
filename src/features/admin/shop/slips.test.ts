import { describe, expect, it } from 'vitest'
import { orderRef, slipOrders } from '@/features/admin/shop/slips'
import type { Order } from '@/types/domain'

const order = (id: string, status: Order['status'], created_at: string): Order =>
  ({ id, status, created_at } as unknown as Order)

const orders = [
  order('aaaaaaaa-1111-2222-3333-444444444444', 'paid', '2026-10-03'),
  order('bbbbbbbb-1111-2222-3333-444444444444', 'paid', '2026-10-01'),
  order('cccccccc-1111-2222-3333-444444444444', 'packed', '2026-10-02'),
  order('dddddddd-1111-2222-3333-444444444444', 'pending_payment', '2026-10-04'),
]

describe('orderRef', () => {
  it('is the first 8 characters, upper case, without dashes', () => {
    expect(orderRef(orders[0])).toBe('AAAAAAAA')
    expect(orderRef({ id: '3f9a2c1b-0000-0000-0000-000000000000' })).toBe('3F9A2C1B')
  })
})

describe('slipOrders', () => {
  it('prints every paid order waiting to be packed, oldest first, when no ids are given', () => {
    expect(slipOrders(orders, null).map((o) => orderRef(o))).toEqual(['BBBBBBBB', 'AAAAAAAA'])
    expect(slipOrders(orders, []).map((o) => orderRef(o))).toEqual(['BBBBBBBB', 'AAAAAAAA'])
  })
  it('prints exactly the chosen orders, in the order asked', () => {
    const picked = slipOrders(orders, [orders[2].id, orders[0].id])
    expect(picked.map((o) => orderRef(o))).toEqual(['CCCCCCCC', 'AAAAAAAA'])
  })
  it('skips ids that do not exist', () => {
    expect(slipOrders(orders, ['nope', orders[1].id]).map((o) => orderRef(o))).toEqual(['BBBBBBBB'])
    expect(slipOrders(orders, ['nope'])).toEqual([])
  })
})

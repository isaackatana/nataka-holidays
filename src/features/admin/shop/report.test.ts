import { describe, expect, it } from 'vitest'
import {
  baseProductName, buildShopReport, changeLabel, currentMonth, monthLabel, monthOf, monthRange, ordersToCsv,
  previousMonth, recentMonths, CSV_HEADER,
} from '@/features/admin/shop/report'
import type { Order } from '@/types/domain'

const item = (id: string, product_id: string | null, product_name: string, unit_price: number, quantity: number, variant_name: string | null = null) =>
  ({ id, order_id: 'o', product_id, product_name, variant_name, unit_price, quantity })

const order = (over: Partial<Order> & { id: string }): Order =>
  ({
    customer_name: 'Amina', customer_phone: '254712345678', fulfilment: 'handover', status: 'paid',
    subtotal: 0, discount_code: null, discount_amount: 0, delivery_fee: 0, total: 0,
    paid_at: '2026-10-10T08:00:00Z', created_at: '2026-10-10T07:00:00Z', order_items: [], ...over,
  }) as unknown as Order

const orders: Order[] = [
  order({
    id: 'aaaaaaaa-0000-0000-0000-000000000001', subtotal: 3500, discount_code: 'TEN', discount_amount: 350, delivery_fee: 300, total: 3450,
    fulfilment: 'delivery',
    order_items: [item('1', 'p1', 'Kikoy cloth (Blue)', 1500, 2, 'Blue'), item('2', 'p2', 'Sisal basket', 500, 1)],
  }),
  order({
    id: 'bbbbbbbb-0000-0000-0000-000000000002', subtotal: 1500, gift_wrap: true, gift_wrap_fee: 250, total: 1750,
    order_items: [item('3', 'p1', 'Kikoy cloth (Red)', 1500, 1, 'Red')],
  }),
]

describe('months (East Africa Time)', () => {
  it('puts late-evening UTC in the next local day and month', () => {
    expect(monthOf('2026-10-31T22:00:00Z')).toBe('2026-11')
    expect(monthOf('2026-10-31T20:59:59Z')).toBe('2026-10')
  })
  it('gives the UTC range of a local month', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-09-30T21:00:00.000Z', to: '2026-10-31T21:00:00.000Z' })
    expect(monthRange('2026-12').to).toBe('2026-12-31T21:00:00.000Z')
  })
  it('walks back across a year end', () => {
    expect(previousMonth('2026-01')).toBe('2025-12')
    expect(recentMonths(3, new Date('2026-02-15T10:00:00Z').getTime())).toEqual(['2026-02', '2026-01', '2025-12'])
    expect(currentMonth(new Date('2026-12-31T22:30:00Z').getTime())).toBe('2027-01')
  })
  it('labels a month', () => {
    expect(monthLabel('2026-10')).toBe('October 2026')
  })
})

describe('buildShopReport', () => {
  const r = buildShopReport(orders)
  it('adds up money actually paid, and where the difference comes from', () => {
    expect(r.orders).toBe(2)
    expect(r.revenue).toBe(5200)
    expect(r.itemsGross).toBe(5000)
    expect(r.discounts).toBe(350)
    expect(r.deliveryFees).toBe(300)
    expect(r.giftWrapFees).toBe(250)
    expect(r.itemsGross - r.discounts + r.deliveryFees + r.giftWrapFees).toBe(r.revenue)
    expect(r.averageOrder).toBe(2600)
    expect(r.itemsSold).toBe(4)
  })
  it('splits hand-over and delivery', () => {
    expect([r.handover, r.delivery]).toEqual([1, 1])
  })
  it('ranks products by revenue, joining the colours of one product', () => {
    expect(r.topProducts.map((p) => [p.name, p.quantity, p.revenue])).toEqual([
      ['Kikoy cloth', 3, 4500],
      ['Sisal basket', 1, 500],
    ])
  })
  it('totals each discount code', () => {
    expect(r.discountUse).toEqual([{ code: 'TEN', orders: 1, amount: 350 }])
  })
  it('handles no orders', () => {
    const e = buildShopReport([])
    expect(e).toMatchObject({ orders: 0, revenue: 0, averageOrder: 0, topProducts: [], discountUse: [] })
  })
  it('keeps products that were later deleted, by name', () => {
    const x = buildShopReport([order({ id: 'c', total: 100, order_items: [item('9', null, 'Old thing', 100, 1)] })])
    expect(x.topProducts[0]).toMatchObject({ name: 'Old thing', quantity: 1 })
  })
})

describe('baseProductName', () => {
  it('removes only the colour the database added', () => {
    expect(baseProductName({ product_name: 'Kikoy cloth (Blue)', variant_name: 'Blue' })).toBe('Kikoy cloth')
    expect(baseProductName({ product_name: 'Bowl (large)', variant_name: null })).toBe('Bowl (large)')
  })
})

describe('changeLabel', () => {
  it('compares with last month', () => {
    expect(changeLabel(1200, 1000)).toBe('+20%')
    expect(changeLabel(900, 1000)).toBe('-10%')
    expect(changeLabel(1000, 1000)).toBe('no change')
    expect(changeLabel(500, 0)).toBeNull()
  })
})

describe('ordersToCsv', () => {
  it('writes a header and one row per order, with local paid time', () => {
    const lines = ordersToCsv(orders).split('\r\n')
    expect(lines[0]).toBe(CSV_HEADER.join(','))
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('AAAAAAAA')
    expect(lines[1]).toContain('2026-10-10 11:00')
    expect(lines[1]).toContain(',2 x Kikoy cloth (Blue); 1 x Sisal basket,')
    expect(lines[1]).toContain(',TEN,350,300,0,3450,paid')
    expect(lines[2]).toContain(',,0,0,250,1750,paid')
  })
  it('quotes commas and quotes, and defuses spreadsheet formulas', () => {
    const csv = ordersToCsv([order({ id: 'd', customer_name: '=HYPERLINK("x")', total: 1, order_items: [] })])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    const comma = ordersToCsv([order({ id: 'e', customer_name: 'Doe, Jane' })])
    expect(comma).toContain('"Doe, Jane"')
  })
})

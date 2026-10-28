import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import AdminShopReport from '@/pages/admin/ShopReport'
import type { Order } from '@/types/domain'

const item = (id: string, product_id: string, product_name: string, unit_price: number, quantity: number, variant_name: string | null = null) =>
  ({ id, order_id: 'o', product_id, product_name, variant_name, unit_price, quantity })

const orders = [
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000001', customer_name: 'Amina', customer_phone: '254712345678', fulfilment: 'delivery', status: 'paid',
    subtotal: 3500, discount_code: 'TEN', discount_amount: 350, delivery_fee: 300, total: 3450, paid_at: '2026-10-10T08:00:00Z', created_at: '2026-10-10T07:00:00Z',
    order_items: [item('1', 'p1', 'Kikoy cloth (Blue)', 1500, 2, 'Blue'), item('2', 'p2', 'Sisal basket', 500, 1)],
  },
] as unknown as Order[]

let current: Order[] = orders
const calls: string[] = []
vi.mock('@/features/admin/shop/queries', () => ({
  useSalesOrders: (from: string) => {
    calls.push(from)
    return { data: current, isLoading: false, isError: false }
  },
}))

afterEach(() => {
  cleanup()
  calls.length = 0
  current = orders
  vi.restoreAllMocks()
})

describe('Shop sales report page', () => {
  it('shows the month\'s numbers, the money breakdown, products and codes', () => {
    render(<AdminShopReport />)
    expect(screen.getByText('Money paid', { selector: 'p' }).nextSibling?.textContent).toMatch(/3,450/)
    expect(screen.getByText('Orders', { selector: 'p' }).nextSibling?.textContent).toBe('1')
    expect(screen.getByText('Items sold').nextSibling?.textContent).toBe('3')
    expect(screen.getByText('Kikoy cloth')).toBeTruthy()
    expect(screen.getByText('Sisal basket')).toBeTruthy()
    expect(screen.getByText('TEN')).toBeTruthy()
    expect(screen.getByText(/1 delivery/)).toBeTruthy()
  })

  it('asks for the chosen month, and for the month before it to compare', () => {
    render(<AdminShopReport />)
    const select = screen.getByLabelText('Month') as HTMLSelectElement
    const other = select.options[2].value
    calls.length = 0
    fireEvent.change(select, { target: { value: other } })
    expect(select.value).toBe(other)
    expect(new Set(calls).size).toBe(2) // this month and the one before
  })

  it('says so for a month with no sales and switches the CSV button off', () => {
    current = []
    render(<AdminShopReport />)
    expect(screen.getByText(/No paid shop orders in/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /download csv/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('downloads a CSV of the month', async () => {
    const create = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<AdminShopReport />)
    fireEvent.click(screen.getByRole('button', { name: /download csv/i }))
    expect(create).toHaveBeenCalledTimes(1)
    const blob = (create.mock.calls[0] as unknown as [Blob])[0]
    expect(await blob.text()).toContain('AAAAAAAA')
    expect(click).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

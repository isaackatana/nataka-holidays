import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminPackingSlips from '@/pages/admin/PackingSlips'

const items = (n: number) => [
  { id: `i${n}a`, order_id: `o${n}`, product_id: 'p1', product_name: 'Kikoy cloth (Blue)', unit_price: 1500, quantity: 2 },
  { id: `i${n}b`, order_id: `o${n}`, product_id: 'p2', product_name: 'Sisal basket', unit_price: 800, quantity: 1 },
]
const orders = [
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000001', customer_name: 'Amina Hassan', customer_phone: '254712345678', fulfilment: 'delivery',
    delivery_address: '12 Beach Road, Diani', handover_note: null, status: 'paid', total: 3800, discount_amount: 0, admin_note: 'Gift wrap please',
    created_at: '2026-10-01T08:00:00Z', order_items: items(1),
  },
  {
    id: 'bbbbbbbb-0000-0000-0000-000000000002', customer_name: 'Joe Mwangi', customer_phone: '254722000111', fulfilment: 'handover',
    delivery_address: null, handover_note: 'Beach Villa, 12-16 Nov', status: 'paid', total: 2000, discount_amount: 200, admin_note: null,
    created_at: '2026-10-02T08:00:00Z', order_items: items(2),
  },
]

vi.mock('@/features/admin/shop/queries', () => ({ useAdminOrders: () => ({ data: orders, isLoading: false, isError: false }) }))
vi.mock('@/features/settings/queries', () => ({ useBusinessSettings: () => ({ data: { business_name: 'Nataka Holidays', contact_phone: '0700 000 000' } }) }))

afterEach(cleanup)

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AdminPackingSlips />
    </MemoryRouter>,
  )
}

describe('Packing slips page', () => {
  it('prints one slip per paid order waiting, with what to pack and where it goes', () => {
    renderAt('/admin/orders/print')
    expect(screen.getAllByText('Packing slip')).toHaveLength(2)
    expect(screen.getAllByText('Kikoy cloth (Blue)')).toHaveLength(2)
    expect(screen.getByText('12 Beach Road, Diani')).toBeTruthy()
    expect(screen.getByText('Beach Villa, 12-16 Nov')).toBeTruthy()
    expect(screen.getByText('Deliver to')).toBeTruthy()
    expect(screen.getByText('Hand over at')).toBeTruthy()
    expect(screen.getByText(/Gift wrap please/)).toBeTruthy()
    expect(screen.getByText(/includes .*200 discount/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /print 2 slips/i })).toBeTruthy()
  })

  it('prints just the order asked for', () => {
    renderAt('/admin/orders/print?ids=bbbbbbbb-0000-0000-0000-000000000002')
    expect(screen.getAllByText('Packing slip')).toHaveLength(1)
    expect(screen.getByText('Joe Mwangi')).toBeTruthy()
    expect(screen.queryByText('Amina Hassan')).toBeNull()
    expect(screen.getByRole('button', { name: /print slip/i })).toBeTruthy()
  })

  it('says so when the order cannot be found, and offers nothing to print', () => {
    renderAt('/admin/orders/print?ids=missing')
    expect(screen.getByText(/could not be found/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: /print slip/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('opens the print dialog', () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    renderAt('/admin/orders/print')
    fireEvent.click(screen.getByRole('button', { name: /print 2 slips/i }))
    expect(print).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

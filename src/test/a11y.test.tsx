// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { AvailabilityCalendar } from '@/components/property/AvailabilityCalendar'
import { InputField } from '@/components/ui/InputField'
import { PayBookingPanel } from '@/features/bookings/PayBookingPanel'
import { PaymentPanel } from '@/features/admin/payments/PaymentPanel'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ShopCartProvider } from '@/features/shop/ShopCartContext'
import ShopCheckout from '@/pages/public/ShopCheckout'
import AdminOrders from '@/pages/admin/Orders'

// The Supabase client throws at import time without env vars; these panels
// only call it inside mutations, which these tests never trigger.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ profile: { full_name: 'Amina Hassan', phone: '0712345678' }, user: { id: 'u1' } }) }))
vi.mock('@/features/settings/queries', () => ({ useBusinessSettings: () => ({ data: { shop_delivery_fee: 300 } }) }))
vi.mock('@/features/admin/shop/queries', () => ({
  useAdminOrders: () => ({ data: [{ id: 'o1', customer_name: 'Amina', customer_phone: '254712345678', fulfilment: 'delivery', delivery_address: 'Beach Road', handover_note: null, delivery_fee: 300, subtotal: 1500, total: 1800, status: 'paid', admin_note: null, created_at: '2026-10-13T09:00:00Z', order_items: [{ id: 'i1', product_name: 'Kikoy cloth', unit_price: 1500, quantity: 1 }] }], isLoading: false, isError: false }),
  useSetOrderStatus: () => ({ mutate: () => {}, isPending: false, error: null }),
  useMarkOrderPaid: () => ({ mutate: () => {}, isPending: false, error: null }),
}))

afterEach(cleanup)

/** Runs axe on rendered output. Colour contrast needs real layout, which
 * jsdom doesn't have, so it's checked by calculation instead (see the
 * palette notes in src/index.css). */
async function violations(ui: ReactElement) {
  const client = new QueryClient()
  const { container } = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)
}

const payment = {
  id: 'p1',
  booking_id: 'b1',
  amount: 30000,
  phone: '254712345678',
  method: 'mpesa' as const,
  note: null,
  status: 'success' as const,
  mpesa_receipt: 'SIA1B2C3D4',
  result_desc: null,
  paid_amount: 30000,
  created_at: '2026-10-01T09:00:00Z',
}

describe('accessibility (axe)', () => {
  it('availability calendar', async () => {
    expect(
      await violations(
        <AvailabilityCalendar
          blocks={[{ start_date: '2026-10-10', end_date: '2026-10-13' }]}
          value={{ checkIn: '2026-10-05', checkOut: '2026-10-08' }}
          onChange={() => {}}
        />,
      ),
    ).toEqual([])
  })

  it('form field with an error', async () => {
    expect(
      await violations(<InputField label="Email" error="Enter a valid email address" />),
    ).toEqual([])
  })

  it('guest pay panel', async () => {
    expect(
      await violations(
        <PayBookingPanel
          bookingId="b1"
          guestPhone="0712345678"
          estimatedTotal={100000}
          payments={[payment]}
        />,
      ),
    ).toEqual([])
  })

  it('admin payments panel', async () => {
    expect(
      await violations(
        <PaymentPanel
          bookingId="b1"
          guestPhone="0712345678"
          estimatedTotal={100000}
          payments={[
            payment,
            { ...payment, id: 'p2', method: 'cash', mpesa_receipt: null, note: 'Paid at office' },
          ]}
          canRequest
        />,
      ),
    ).toEqual([])
  })

  it('shop checkout form', async () => {
    localStorage.setItem('nataka-shop-cart', JSON.stringify([{ productId: 'p1', name: 'Kikoy cloth', slug: 'kikoy', price: 1500, imagePath: null, quantity: 1, maxQuantity: 5 }]))
    const out = await violations(
      <HelmetProvider>
        <MemoryRouter>
          <ShopCartProvider>
            <ShopCheckout />
          </ShopCartProvider>
        </MemoryRouter>
      </HelmetProvider>,
    )
    localStorage.clear()
    expect(out).toEqual([])
  })

  it('admin shop orders', async () => {
    expect(await violations(<MemoryRouter><AdminOrders /></MemoryRouter>)).toEqual([])
  })
})

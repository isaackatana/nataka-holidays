import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import ShopCheckout from '@/pages/public/ShopCheckout'
import { ShopCartProvider } from '@/features/shop/ShopCartContext'
import { checkDiscountCode, placeOrder } from '@/services/shop.service'

vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: p } }) }) } } }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ profile: { full_name: 'Amina Hassan', phone: '0712345678' }, user: { id: 'u1' } }) }))
vi.mock('@/features/settings/queries', () => ({ useBusinessSettings: () => ({ data: { shop_delivery_fee: 300 } }) }))
vi.mock('@/services/shop.service', () => ({
  checkDiscountCode: vi.fn(),
  placeOrder: vi.fn(),
  payForOrder: vi.fn(),
}))

const line = {
  key: 'p1', productId: 'p1', variantId: null, variantName: null, name: 'Kikoy cloth', slug: 'kikoy',
  price: 1000, imagePath: null, quantity: 2, maxQuantity: 10,
}

beforeEach(() => {
  localStorage.setItem('nataka-shop-cart', JSON.stringify([line]))
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

function renderCheckout() {
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ShopCartProvider>
            <ShopCheckout />
          </ShopCartProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  )
}

describe('Shop checkout discount code', () => {
  it('applies a valid code, shows the discount and lowers the total', async () => {
    vi.mocked(checkDiscountCode).mockResolvedValue({ ok: true, code: 'WELCOME10', amount: 200 })
    renderCheckout()
    fireEvent.change(screen.getByLabelText('Discount code'), { target: { value: 'welcome10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText(/applied:/)).toBeTruthy()
    expect(checkDiscountCode).toHaveBeenCalledWith('welcome10', 2000)
    expect(screen.getByText(/Discount \(WELCOME10\)/)).toBeTruthy()
    // 2000 items - 200 discount = 1800 (hand-over, so no delivery fee)
    expect(screen.getByText('Total').nextSibling?.textContent).toMatch(/1,800/)
  })

  it('shows the database\'s reason when a code is refused, and takes nothing off', async () => {
    vi.mocked(checkDiscountCode).mockResolvedValue({ ok: false, message: 'That code is not valid or has expired.' })
    renderCheckout()
    fireEvent.change(screen.getByLabelText('Discount code'), { target: { value: 'NOPE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/not valid or has expired/)
    expect(screen.queryByText(/Discount \(/)).toBeNull()
    expect(screen.getByText('Total').nextSibling?.textContent).toMatch(/2,000/)
  })

  it('sends the applied code with the order', async () => {
    vi.mocked(checkDiscountCode).mockResolvedValue({ ok: true, code: 'WELCOME10', amount: 200 })
    vi.mocked(placeOrder).mockRejectedValue(new Error('stop here'))
    renderCheckout()
    fireEvent.change(screen.getByLabelText('Discount code'), { target: { value: 'WELCOME10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await screen.findByText(/Discount \(WELCOME10\)/)
    fireEvent.change(screen.getByPlaceholderText(/Beach Villa/), { target: { value: 'Beach Villa, 12-16 Nov' } })
    fireEvent.click(screen.getByRole('button', { name: /place order/i }))
    await waitFor(() => expect(placeOrder).toHaveBeenCalled())
    expect(vi.mocked(placeOrder).mock.calls[0][0].discountCode).toBe('WELCOME10')
  })

  it('lets the guest remove the code again', async () => {
    vi.mocked(checkDiscountCode).mockResolvedValue({ ok: true, code: 'WELCOME10', amount: 200 })
    renderCheckout()
    fireEvent.change(screen.getByLabelText('Discount code'), { target: { value: 'WELCOME10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))
    expect(screen.queryByText(/Discount \(/)).toBeNull()
    expect(screen.getByText('Total').nextSibling?.textContent).toMatch(/2,000/)
  })
})

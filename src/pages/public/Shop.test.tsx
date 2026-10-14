import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Shop from '@/pages/public/Shop'
import { ShopCartProvider, useShopCart } from '@/features/shop/ShopCartContext'
import { getShopProducts } from '@/services/shop.service'
import type { Product } from '@/types/domain'

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://img.test/p.webp' } }) }) } },
}))
vi.mock('@/services/shop.service', () => ({ getShopProducts: vi.fn() }))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const product = (over: Partial<Product>): Product => ({
  id: 'p1', name: 'Kikoy cloth', slug: 'kikoy', description: 'Soft cotton.', price: 1500, stock: 5,
  image_path: null, is_active: true, created_at: '', updated_at: '', ...over,
})

function CartProbe() {
  const { count, subtotal } = useShopCart()
  return <p data-testid="cart">{count}/{subtotal}</p>
}

function renderShop(products: Product[]) {
  vi.mocked(getShopProducts).mockResolvedValue(products)
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ShopCartProvider>
            <Shop />
            <CartProbe />
          </ShopCartProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  )
}

describe('Shop page', () => {
  it('shows products with price and stock, and adds to the cart', async () => {
    renderShop([product({}), product({ id: 'p2', name: 'Sisal basket', slug: 'basket', price: 800, stock: 2 })])
    expect(await screen.findByText('Kikoy cloth')).toBeTruthy()
    expect(screen.getByText('Only 2 left')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /add to cart/i })[0])
    expect(screen.getByTestId('cart').textContent).toBe('1/1500')
    expect(screen.getByRole('link', { name: /view cart and check out/i }).getAttribute('href')).toBe('/shop/checkout')
  })

  it("won't add more than what's in stock", async () => {
    renderShop([product({ stock: 1 })])
    const button = await screen.findByRole('button', { name: /add to cart/i })
    fireEvent.click(button)
    expect((screen.getByRole('button', { name: /in cart/i }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('cart').textContent).toBe('1/1500')
  })

  it('disables a sold-out product', async () => {
    renderShop([product({ stock: 0 })])
    const button = (await screen.findByRole('button', { name: 'Sold out' })) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('says so when there is nothing for sale yet', async () => {
    renderShop([])
    expect(await screen.findByText(/being stocked/i)).toBeTruthy()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CartSuggestions } from '@/features/shop/CartSuggestions'
import { ShopCartProvider, useShopCart } from '@/features/shop/ShopCartContext'
import { getRelatedProducts, getShopProducts } from '@/services/shop.service'
import type { Product } from '@/types/domain'

vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: p } }) }) } } }))
vi.mock('@/services/shop.service', () => ({ getRelatedProducts: vi.fn(), getShopProducts: vi.fn() }))

const product = (over: Partial<Product>): Product => ({
  id: 'x', name: 'Item', slug: 'item', description: '', price: 1000, stock: 5, image_path: null,
  category: 'Textiles', is_active: true, created_at: '', updated_at: '', ...over,
})
const catalogue = [
  product({ id: 'p1', name: 'Kikoy cloth', slug: 'kikoy' }),
  product({ id: 'p2', name: 'Sisal basket', slug: 'basket', price: 800 }),
  product({ id: 'p3', name: 'Coconut bowl', slug: 'bowl', price: 600, product_variants: [{ id: 'v1' }, { id: 'v2' }] }),
]

const line = {
  key: 'p1', productId: 'p1', variantId: null, variantName: null, name: 'Kikoy cloth', slug: 'kikoy',
  price: 1000, imagePath: null, quantity: 1, maxQuantity: 5,
}

function CartProbe() {
  return <p data-testid="count">{useShopCart().count}</p>
}

beforeEach(() => {
  localStorage.setItem('nataka-shop-cart', JSON.stringify([line]))
  vi.mocked(getShopProducts).mockResolvedValue(catalogue)
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

function renderIt() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ShopCartProvider>
          <CartSuggestions />
          <CartProbe />
        </ShopCartProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CartSuggestions', () => {
  it('asks for suggestions for what is in the cart and shows them in the given order', async () => {
    vi.mocked(getRelatedProducts).mockResolvedValue([{ product_id: 'p2', together: 3 }, { product_id: 'p3', together: 0 }])
    renderIt()
    const links = await screen.findAllByRole('link', { name: /sisal basket|coconut bowl/i })
    expect(links[0].getAttribute('href')).toBe('/shop/basket')
    expect(getRelatedProducts).toHaveBeenCalledWith(['p1'])
  })

  it('marks only the ones actually bought together', async () => {
    vi.mocked(getRelatedProducts).mockResolvedValue([{ product_id: 'p2', together: 3 }, { product_id: 'p3', together: 0 }])
    renderIt()
    await screen.findByText('Often bought together')
    expect(screen.getAllByText('Often bought together')).toHaveLength(1)
  })

  it('adds a suggestion to the cart with one tap', async () => {
    vi.mocked(getRelatedProducts).mockResolvedValue([{ product_id: 'p2', together: 1 }])
    renderIt()
    fireEvent.click(await screen.findByRole('button', { name: /add sisal basket/i }))
    expect(screen.getByTestId('count').textContent).toBe('2')
  })

  it('sends products with colours to their page instead', async () => {
    vi.mocked(getRelatedProducts).mockResolvedValue([{ product_id: 'p3', together: 0 }])
    renderIt()
    const link = await screen.findByRole('link', { name: /choose colour/i })
    expect(link.getAttribute('href')).toBe('/shop/bowl')
    expect(screen.queryByRole('button', { name: /add coconut bowl/i })).toBeNull()
  })

  it('shows nothing when there are no suggestions, or a suggested product is no longer listed', async () => {
    vi.mocked(getRelatedProducts).mockResolvedValue([{ product_id: 'gone', together: 2 }])
    renderIt()
    await vi.waitFor(() => expect(getRelatedProducts).toHaveBeenCalled())
    expect(screen.queryByText('You might also like')).toBeNull()
  })
})

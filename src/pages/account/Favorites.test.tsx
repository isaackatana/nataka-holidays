import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Favorites from '@/pages/account/Favorites'
import { ShopCartProvider, useShopCart } from '@/features/shop/ShopCartContext'
import { getShopProducts } from '@/services/shop.service'
import { getProductFavoriteIds, removeProductFavorite } from '@/services/productFavorites.service'
import type { Product } from '@/types/domain'

vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: p } }) }) } } }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: null }) }))
vi.mock('@/features/favorites/queries', () => ({
  useFavoriteProperties: () => ({ data: [], isLoading: false, isError: false }),
}))
vi.mock('@/features/favorites/useFavoriteActions', () => ({ useFavoriteActions: () => ({ isFavorited: () => false, handleToggle: vi.fn() }) }))
vi.mock('@/services/shop.service', () => ({ getShopProducts: vi.fn() }))
vi.mock('@/services/productFavorites.service', () => ({
  getProductFavoriteIds: vi.fn(),
  addProductFavorite: vi.fn().mockResolvedValue(undefined),
  removeProductFavorite: vi.fn().mockResolvedValue(undefined),
}))

const product = (over: Partial<Product>): Product => ({
  id: 'p1', name: 'Kikoy cloth', slug: 'kikoy', description: '', price: 1500, stock: 5, image_path: null,
  category: 'Textiles', is_active: true, created_at: '', updated_at: '', ...over,
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

function CartProbe() {
  return <p data-testid="count">{useShopCart().count}</p>
}

function renderIt(products: Product[], savedIds: string[]) {
  vi.mocked(getShopProducts).mockResolvedValue(products)
  vi.mocked(getProductFavoriteIds).mockResolvedValue(savedIds)
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ShopCartProvider>
            <Favorites />
            <CartProbe />
          </ShopCartProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  )
}

describe('Favorites page, saved shop items', () => {
  it('lists the saved products in the order they were saved, skipping ones no longer in the shop', async () => {
    renderIt(
      [product({}), product({ id: 'p2', name: 'Sisal basket', slug: 'basket', price: 800 })],
      ['p2', 'gone', 'p1'],
    )
    const links = await screen.findAllByRole('link', { name: /^View / })
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/shop/basket', '/shop/kikoy'])
  })

  it('says so when nothing is saved and points to the shop', async () => {
    renderIt([product({})], [])
    expect(await screen.findByText(/haven't saved any shop items yet/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /browse the shop/i }).getAttribute('href')).toBe('/shop')
  })

  it('adds a saved item to the cart and removes it from the list with the heart', async () => {
    renderIt([product({})], ['p1'])
    fireEvent.click(await screen.findByRole('button', { name: 'Add Kikoy cloth to cart' }))
    expect(screen.getByTestId('count').textContent).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Kikoy cloth from favorites' }))
    await vi.waitFor(() => expect(removeProductFavorite).toHaveBeenCalledWith('u1', 'p1'))
  })

  it('sends products with colours to their page, and shows sold-out ones as such', async () => {
    renderIt(
      [product({ product_variants: [{ id: 'v1' }] }), product({ id: 'p2', name: 'Sisal basket', slug: 'basket', stock: 0 })],
      ['p1', 'p2'],
    )
    expect(await screen.findByRole('link', { name: /choose colour/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /sold out · see options/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /add .* to cart/i })).toBeNull()
  })
})

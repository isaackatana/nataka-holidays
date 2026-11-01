import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Shop from '@/pages/public/Shop'
import { ShopCartProvider, useShopCart } from '@/features/shop/ShopCartContext'
import { getShopProducts } from '@/services/shop.service'
import { addProductFavorite, getProductFavoriteIds, removeProductFavorite } from '@/services/productFavorites.service'
import type { Product } from '@/types/domain'

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://img.test/p.webp' } }) }) } },
}))
vi.mock('@/services/shop.service', () => ({ getShopProducts: vi.fn() }))
vi.mock('@/services/productFavorites.service', () => ({
  getProductFavoriteIds: vi.fn().mockResolvedValue([]),
  addProductFavorite: vi.fn().mockResolvedValue(undefined),
  removeProductFavorite: vi.fn().mockResolvedValue(undefined),
}))

let signedIn: { id: string } | null = null
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: signedIn, profile: null }) }))

afterEach(() => {
  cleanup()
  localStorage.clear()
  signedIn = null
  vi.clearAllMocks()
})

const product = (over: Partial<Product>): Product => ({
  id: 'p1', name: 'Kikoy cloth', slug: 'kikoy', description: 'Soft cotton.', price: 1500, stock: 5,
  image_path: null, category: 'Textiles', is_active: true, created_at: '', updated_at: '', ...over,
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

  it('filters by category and by search, and can be cleared', async () => {
    renderShop([
      product({}),
      product({ id: 'p2', name: 'Sisal basket', slug: 'basket', category: 'Baskets', price: 800 }),
    ])
    expect(await screen.findByText('Sisal basket')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Baskets/ }))
    expect(screen.queryByText('Kikoy cloth')).toBeNull()
    expect(screen.getByText('Sisal basket')).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox', { name: /search the shop/i }), { target: { value: 'zzz' } })
    expect(screen.getByText(/nothing matches/i)).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /clear filters/i })[0])
    expect(screen.getByText('Kikoy cloth')).toBeTruthy()
    expect(screen.getByText('Sisal basket')).toBeTruthy()
  })

  it('hides sold-out products with the in-stock filter', async () => {
    renderShop([product({}), product({ id: 'p2', name: 'Sisal basket', slug: 'basket', stock: 0 })])
    expect(await screen.findByText('Sisal basket')).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/in stock only/i))
    expect(screen.queryByText('Sisal basket')).toBeNull()
    expect(screen.getByText('Kikoy cloth')).toBeTruthy()
  })

  it('links each product to its own page', async () => {
    renderShop([product({})])
    const link = await screen.findByRole('link', { name: 'Kikoy cloth' })
    expect(link.getAttribute('href')).toBe('/shop/kikoy')
  })

  it('sends products with colours to their page instead of adding straight to the cart', async () => {
    renderShop([product({ product_variants: [{ id: 'v1' }, { id: 'v2' }] })])
    const link = await screen.findByRole('link', { name: /choose colour/i })
    expect(link.getAttribute('href')).toBe('/shop/kikoy')
    expect(screen.queryByRole('button', { name: /add to cart/i })).toBeNull()
  })

  describe('saving products (hearts)', () => {
    it('saves a product for a signed-in guest', async () => {
      signedIn = { id: 'u1' }
      vi.mocked(getProductFavoriteIds).mockResolvedValue([])
      renderShop([product({})])
      fireEvent.click(await screen.findByRole('button', { name: 'Save Kikoy cloth to favorites' }))
      await vi.waitFor(() => expect(addProductFavorite).toHaveBeenCalledWith('u1', 'p1'))
    })

    it('shows a saved product as saved and removes it on the next tap', async () => {
      signedIn = { id: 'u1' }
      vi.mocked(getProductFavoriteIds).mockResolvedValue(['p1'])
      renderShop([product({})])
      const heart = await screen.findByRole('button', { name: 'Remove Kikoy cloth from favorites' })
      expect(heart.getAttribute('aria-pressed')).toBe('true')
      fireEvent.click(heart)
      await vi.waitFor(() => expect(removeProductFavorite).toHaveBeenCalledWith('u1', 'p1'))
    })

    it('sends a visitor who is not signed in to sign in, saving nothing', async () => {
      renderShop([product({})])
      fireEvent.click(await screen.findByRole('button', { name: 'Save Kikoy cloth to favorites' }))
      expect(addProductFavorite).not.toHaveBeenCalled()
    })

    it('keeps the heart outside the product link, so tapping it never opens the product page', async () => {
      renderShop([product({})])
      const heart = await screen.findByRole('button', { name: 'Save Kikoy cloth to favorites' })
      expect(heart.closest('a')).toBeNull()
    })
  })

  describe('sale prices', () => {
    it('shows the original price crossed out and a sale tag, with the real price first', async () => {
      renderShop([product({ price: 800, compare_at_price: 1000 })])
      expect(await screen.findByText('Sale −20%')).toBeTruthy()
      const was = screen.getByText(/1,000/)
      expect(was.closest('del')).toBeTruthy()
      expect(screen.getByText(/Was/)).toBeTruthy()
    })

    it('shows nothing special for a product that is not on sale', async () => {
      renderShop([product({})])
      await screen.findByText('Kikoy cloth')
      expect(screen.queryByText(/Sale/)).toBeNull()
      expect(document.querySelector('del')).toBeNull()
    })

    it('can show only the products on sale', async () => {
      renderShop([product({}), product({ id: 'p2', name: 'Sisal basket', slug: 'basket', price: 600, compare_at_price: 800 })])
      await screen.findByText('Sisal basket')
      fireEvent.click(screen.getByLabelText('On sale'))
      expect(screen.queryByText('Kikoy cloth')).toBeNull()
      expect(screen.getByText('Sisal basket')).toBeTruthy()
    })

    it('adds the real price to the cart, not the crossed-out one', async () => {
      renderShop([product({ price: 800, compare_at_price: 1000 })])
      fireEvent.click(await screen.findByRole('button', { name: /add to cart/i }))
      expect(screen.getByTestId('cart').textContent).toBe('1/800')
    })
  })
})

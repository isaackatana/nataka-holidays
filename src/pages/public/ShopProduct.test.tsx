import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import ShopProduct from '@/pages/public/ShopProduct'
import { ShopCartProvider, useShopCart } from '@/features/shop/ShopCartContext'
import { getShopProduct, getShopProducts } from '@/services/shop.service'
import type { ProductWithImages } from '@/types/domain'

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://img.test/${p}` } }) }) } },
}))
vi.mock('@/services/shop.service', () => ({ getShopProduct: vi.fn(), getShopProducts: vi.fn() }))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const product = (over: Partial<ProductWithImages> = {}): ProductWithImages => ({
  id: 'p1', name: 'Kikoy cloth', slug: 'kikoy', description: 'Soft cotton.', price: 1500, stock: 5,
  image_path: 'a.webp', category: 'Textiles', is_active: true, created_at: '', updated_at: '',
  product_images: [
    { id: 'i1', product_id: 'p1', storage_path: 'a.webp', sort_order: 0 },
    { id: 'i2', product_id: 'p1', storage_path: 'b.webp', sort_order: 1 },
  ],
  product_variants: [],
  ...over,
})

function CartProbe() {
  const { count, subtotal } = useShopCart()
  return <p data-testid="cart">{count}/{subtotal}</p>
}

function renderPage(found: ProductWithImages | null) {
  vi.mocked(getShopProduct).mockResolvedValue(found)
  vi.mocked(getShopProducts).mockResolvedValue(found ? [found] : [])
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/shop/kikoy']}>
          <ShopCartProvider>
            <Routes>
              <Route path="/shop/:slug" element={<ShopProduct />} />
            </Routes>
            <CartProbe />
          </ShopCartProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  )
}

describe('Shop product page', () => {
  it('shows the details and every photo', async () => {
    renderPage(product())
    expect(await screen.findByRole('heading', { name: 'Kikoy cloth' })).toBeTruthy()
    expect(screen.getByText('Soft cotton.')).toBeTruthy()
    expect(screen.getByText('Textiles')).toBeTruthy()
    expect(screen.getByText('In stock')).toBeTruthy()
    expect(screen.getByText(/view all 2 photos/i)).toBeTruthy()
  })

  it('adds the chosen quantity to the cart, never beyond the stock', async () => {
    renderPage(product({ stock: 3 }))
    await screen.findByRole('heading', { name: 'Kikoy cloth' })
    const more = screen.getByRole('button', { name: 'One more' }) as HTMLButtonElement
    fireEvent.click(more)
    fireEvent.click(more)
    expect(more.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }))
    expect(screen.getByTestId('cart').textContent).toBe('3/4500')
    expect((screen.getByRole('button', { name: /all available are in your cart/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows a sold-out product without a way to buy it', async () => {
    renderPage(product({ stock: 0 }))
    const button = (await screen.findByRole('button', { name: 'Sold out' })) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'One more' })).toBeNull()
  })

  it('says so when the product does not exist', async () => {
    renderPage(null)
    expect(await screen.findByText(/could not find that product/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /back to the shop/i }).getAttribute('href')).toBe('/shop')
  })

  it('offers WhatsApp questions and sharing for the product', async () => {
    renderPage(product())
    const ask = await screen.findByRole('link', { name: /ask about this/i })
    expect(decodeURIComponent(ask.getAttribute('href') ?? '')).toContain('Kikoy cloth')
    expect(decodeURIComponent(ask.getAttribute('href') ?? '')).toContain('/shop/kikoy')
    expect(screen.getByRole('link', { name: /share on whatsapp/i }).getAttribute('href')).toContain('wa.me/?text=')
    expect(screen.getByRole('button', { name: /copy link/i })).toBeTruthy()
  })

  describe('with colours', () => {
    const withColours = () =>
      product({
        stock: 5,
        product_variants: [
          { id: 'v1', product_id: 'p1', name: 'Blue', stock: 2, sort_order: 0 },
          { id: 'v2', product_id: 'p1', name: 'Red', stock: 0, sort_order: 1 },
          { id: 'v3', product_id: 'p1', name: 'Green', stock: 3, sort_order: 2 },
        ],
      })

    it('asks for a colour before anything can be added', async () => {
      renderPage(withColours())
      const button = (await screen.findByRole('button', { name: /choose a colour/i })) as HTMLButtonElement
      expect(button.disabled).toBe(true)
      expect((screen.getByRole('radio', { name: /red \(sold out\)/i }) as HTMLButtonElement).disabled).toBe(true)
    })

    it('adds the chosen colour, limited by that colour\'s own stock', async () => {
      renderPage(withColours())
      fireEvent.click(await screen.findByRole('radio', { name: 'Blue' }))
      const more = screen.getByRole('button', { name: 'One more' }) as HTMLButtonElement
      fireEvent.click(more)
      expect(more.disabled).toBe(true) // Blue has 2, even though the product total is 5
      fireEvent.click(screen.getByRole('button', { name: /add to cart/i }))
      expect(screen.getByTestId('cart').textContent).toBe('2/3000')
    })

    it('keeps colours separate in the cart', async () => {
      renderPage(withColours())
      fireEvent.click(await screen.findByRole('radio', { name: 'Blue' }))
      fireEvent.click(screen.getByRole('button', { name: /add to cart/i }))
      fireEvent.click(screen.getByRole('radio', { name: 'Green' }))
      fireEvent.click(screen.getByRole('button', { name: /add to cart/i }))
      expect(screen.getByTestId('cart').textContent).toBe('2/3000')
      expect(JSON.parse(localStorage.getItem('nataka-shop-cart') ?? '[]')).toHaveLength(2)
    })
  })
})

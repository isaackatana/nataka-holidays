import { describe, expect, it } from 'vitest'
import { addToCart, cartCount, cartSubtotal, parseSavedCart, previewTotal, removeFromCart, setQuantity } from './cart'

const kikoy = { id: 'p1', name: 'Kikoy cloth', slug: 'kikoy', price: 1500, image_path: null, stock: 5 }
const basket = { id: 'p2', name: 'Sisal basket', slug: 'basket', price: 800, image_path: 'a.webp', stock: 2 }

describe('cart', () => {
  it('adds a product, then adds up repeats', () => {
    let c = addToCart([], kikoy)
    c = addToCart(c, kikoy)
    expect(c).toHaveLength(1)
    expect(c[0].quantity).toBe(2)
  })
  it('never goes past the stock or 20', () => {
    let c = addToCart([], basket, 5)
    expect(c[0].quantity).toBe(2)
    c = addToCart(c, basket)
    expect(c[0].quantity).toBe(2)
    expect(addToCart([], { ...kikoy, stock: 99 }, 50)[0].quantity).toBe(20)
  })
  it('ignores a sold-out product', () => {
    expect(addToCart([], { ...kikoy, stock: 0 })).toEqual([])
  })
  it('refreshes the price when a product is added again', () => {
    const c = addToCart(addToCart([], kikoy), { ...kikoy, price: 1800 })
    expect(c[0].price).toBe(1800)
  })
  it('changes quantity, and removes a line when it reaches 0 or is invalid', () => {
    const c = addToCart(addToCart([], kikoy), basket)
    expect(setQuantity(c, 'p1', 3)[0].quantity).toBe(3)
    expect(setQuantity(c, 'p1', 99)[0].quantity).toBe(5)
    expect(setQuantity(c, 'p1', 0).map((l) => l.productId)).toEqual(['p2'])
    expect(setQuantity(c, 'p1', NaN).map((l) => l.productId)).toEqual(['p2'])
    expect(removeFromCart(c, 'p2').map((l) => l.productId)).toEqual(['p1'])
  })
  it('counts and totals', () => {
    const c = setQuantity(addToCart(addToCart([], kikoy), basket), 'p1', 2)
    expect(cartCount(c)).toBe(3)
    expect(cartSubtotal(c)).toBe(2 * 1500 + 800)
  })
  it('adds the delivery fee only for delivery', () => {
    const c = addToCart([], kikoy)
    expect(previewTotal(c, 'handover', 300)).toBe(1500)
    expect(previewTotal(c, 'delivery', 300)).toBe(1800)
  })
})

describe('parseSavedCart', () => {
  it('round-trips a good cart', () => {
    const c = addToCart([], kikoy, 2)
    expect(parseSavedCart(JSON.stringify(c))).toEqual(c)
  })
  it.each([null, '', 'not json', '{}', '[1,2]', '[{"productId":1}]'])('returns an empty cart for %s', (raw) => {
    expect(parseSavedCart(raw)).toEqual([])
  })
  it('drops lines with impossible values', () => {
    const bad = [{ ...addToCart([], kikoy)[0], quantity: 500 }, { ...addToCart([], basket)[0], price: -5 }]
    expect(parseSavedCart(JSON.stringify(bad))).toEqual([])
  })
})

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  addToCart, cartCount, cartSubtotal, parseSavedCart, removeFromCart, setQuantity,
  type CartLine, type CartProductInfo, type CartVariantInfo,
} from '@/features/shop/cart'

const STORAGE_KEY = 'nataka-shop-cart'

interface ShopCartValue {
  lines: CartLine[]
  count: number
  subtotal: number
  add: (product: CartProductInfo, quantity?: number, variant?: CartVariantInfo) => void
  setQty: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
}

const ShopCartContext = createContext<ShopCartValue | undefined>(undefined)

function load(): CartLine[] {
  try {
    return parseSavedCart(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

export function ShopCartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // Private mode or full storage: the cart just won't survive a reload.
    }
  }, [lines])

  const add = useCallback((product: CartProductInfo, quantity = 1, variant?: CartVariantInfo) => setLines((l) => addToCart(l, product, quantity, variant)), [])
  const setQty = useCallback((id: string, quantity: number) => setLines((l) => setQuantity(l, id, quantity)), [])
  const remove = useCallback((id: string) => setLines((l) => removeFromCart(l, id)), [])
  const clear = useCallback(() => setLines([]), [])

  const value = useMemo(
    () => ({ lines, count: cartCount(lines), subtotal: cartSubtotal(lines), add, setQty, remove, clear }),
    [lines, add, setQty, remove, clear],
  )
  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>
}

export function useShopCart(): ShopCartValue {
  const ctx = useContext(ShopCartContext)
  if (!ctx) throw new Error('useShopCart must be used within a ShopCartProvider')
  return ctx
}

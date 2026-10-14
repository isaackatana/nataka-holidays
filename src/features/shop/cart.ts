// Pure cart logic for the shop (no React, no storage) so it is easy to test.
// The cart only remembers what the guest picked. Prices and stock are
// re-checked by the database when the order is placed, so nothing here is
// trusted for money.

export interface CartLine {
  productId: string
  name: string
  slug: string
  price: number
  imagePath: string | null
  quantity: number
  /** Stock when it was added; used only to stop obviously impossible quantities in the UI. */
  maxQuantity: number
}

export const MAX_PER_LINE = 20

export interface CartProductInfo {
  id: string
  name: string
  slug: string
  price: number
  image_path: string | null
  stock: number
}

function limit(line: Pick<CartLine, 'maxQuantity'>): number {
  return Math.max(0, Math.min(MAX_PER_LINE, line.maxQuantity))
}

export function addToCart(lines: CartLine[], product: CartProductInfo, quantity = 1): CartLine[] {
  if (product.stock < 1) return lines
  const existing = lines.find((l) => l.productId === product.id)
  if (existing) {
    const next = { ...existing, price: product.price, maxQuantity: product.stock }
    return lines.map((l) => (l.productId === product.id ? { ...next, quantity: Math.min(existing.quantity + quantity, limit(next)) } : l))
  }
  const line: CartLine = {
    productId: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    imagePath: product.image_path,
    quantity: 0,
    maxQuantity: product.stock,
  }
  return [...lines, { ...line, quantity: Math.max(1, Math.min(quantity, limit(line))) }]
}

export function setQuantity(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  if (!Number.isFinite(quantity) || quantity < 1) return lines.filter((l) => l.productId !== productId)
  return lines.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(Math.floor(quantity), limit(l)) } : l))
}

export function removeFromCart(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((l) => l.productId !== productId)
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0)
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.quantity, 0)
}

/** Total shown at checkout. The database computes the real one; this only previews it. */
export function previewTotal(lines: CartLine[], fulfilment: 'handover' | 'delivery', deliveryFee: number): number {
  return cartSubtotal(lines) + (fulfilment === 'delivery' ? deliveryFee : 0)
}

/** Reads a saved cart defensively: it lives in the browser, where it can be edited or out of date. */
export function parseSavedCart(raw: string | null): CartLine[] {
  try {
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((l): CartLine[] => {
      if (!l || typeof l !== 'object') return []
      const x = l as Record<string, unknown>
      const ok =
        typeof x.productId === 'string' && typeof x.name === 'string' && typeof x.slug === 'string' &&
        Number.isInteger(x.price) && Number.isInteger(x.quantity) && Number.isInteger(x.maxQuantity) &&
        (x.price as number) > 0 && (x.quantity as number) >= 1 && (x.quantity as number) <= MAX_PER_LINE
      return ok
        ? [{
            productId: x.productId as string, name: x.name as string, slug: x.slug as string,
            price: x.price as number, imagePath: typeof x.imagePath === 'string' ? x.imagePath : null,
            quantity: x.quantity as number, maxQuantity: x.maxQuantity as number,
          }]
        : []
    })
  } catch {
    return []
  }
}

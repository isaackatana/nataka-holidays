/** Whole-number percent off for a sale (e.g. 1000 -> 800 is 20), or null when it is not on sale. */
export function salePercent(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price || price <= 0) return null
  const pct = Math.round(((compareAt - price) / compareAt) * 100)
  return pct >= 1 ? pct : null
}

export function isOnSale(p: { price: number; compare_at_price?: number | null }): boolean {
  return salePercent(p.price, p.compare_at_price) !== null
}

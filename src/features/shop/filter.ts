// Pure filtering and sorting for the shop grid (no React) so it is easy to test.
// The catalogue is small, so everything happens in the browser on the list
// the page already loaded.

import type { Product } from '@/types/domain'

export type ShopSort = 'newest' | 'price-asc' | 'price-desc' | 'name'

export interface ShopFilters {
  search: string
  /** '' means every category. */
  category: string
  inStockOnly: boolean
  sort: ShopSort
}

export const DEFAULT_FILTERS: ShopFilters = { search: '', category: '', inStockOnly: false, sort: 'newest' }

export const SORT_LABELS: Record<ShopSort, string> = {
  newest: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  name: 'Name: A to Z',
}

/** Categories that exist on at least one product, with how many products each has. */
export function categoryCounts(products: Product[]): { category: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1)
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

export function filterProducts(products: Product[], f: ShopFilters): Product[] {
  const words = f.search.toLowerCase().split(/\s+/).filter(Boolean)
  const matched = products.filter((p) => {
    if (f.category && p.category !== f.category) return false
    if (f.inStockOnly && p.stock < 1) return false
    if (words.length === 0) return true
    const haystack = `${p.name} ${p.description} ${p.category}`.toLowerCase()
    return words.every((w) => haystack.includes(w))
  })

  const sorted = [...matched]
  switch (f.sort) {
    case 'price-asc':
      sorted.sort((a, b) => a.price - b.price)
      break
    case 'price-desc':
      sorted.sort((a, b) => b.price - a.price)
      break
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name))
      break
    default:
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  return sorted
}

export function hasActiveFilters(f: ShopFilters): boolean {
  return f.search.trim() !== '' || f.category !== '' || f.inStockOnly
}

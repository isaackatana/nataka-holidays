import { describe, expect, it } from 'vitest'
import { categoryCounts, DEFAULT_FILTERS, filterProducts, hasActiveFilters } from '@/features/shop/filter'
import type { Product } from '@/types/domain'

const p = (over: Partial<Product>): Product => ({
  id: 'x', name: 'Item', slug: 'item', description: '', price: 1000, stock: 5, image_path: null,
  category: 'Other', is_active: true, created_at: '2026-01-01', updated_at: '', ...over,
})

const catalogue = [
  p({ id: '1', name: 'Kikoy cloth', category: 'Textiles', price: 1500, created_at: '2026-03-01' }),
  p({ id: '2', name: 'Sisal basket', category: 'Baskets', price: 800, stock: 0, created_at: '2026-02-01' }),
  p({ id: '3', name: 'Coconut bowl', category: 'Kitchen', description: 'Hand carved', price: 600, created_at: '2026-04-01' }),
]
const ids = (list: Product[]) => list.map((x) => x.id)

describe('filterProducts', () => {
  it('shows everything, newest first, by default', () => {
    expect(ids(filterProducts(catalogue, DEFAULT_FILTERS))).toEqual(['3', '1', '2'])
  })
  it('filters by category', () => {
    expect(ids(filterProducts(catalogue, { ...DEFAULT_FILTERS, category: 'Textiles' }))).toEqual(['1'])
  })
  it('hides sold-out products when asked', () => {
    expect(ids(filterProducts(catalogue, { ...DEFAULT_FILTERS, inStockOnly: true }))).toEqual(['3', '1'])
  })
  it('searches name, description and category, every word must match', () => {
    expect(ids(filterProducts(catalogue, { ...DEFAULT_FILTERS, search: 'carved' }))).toEqual(['3'])
    expect(ids(filterProducts(catalogue, { ...DEFAULT_FILTERS, search: 'BASKETS sisal' }))).toEqual(['2'])
    expect(ids(filterProducts(catalogue, { ...DEFAULT_FILTERS, search: 'sisal cloth' }))).toEqual([])
  })
  it('sorts by price and by name', () => {
    expect(ids(filterProducts(catalogue, { ...DEFAULT_FILTERS, sort: 'price-asc' }))).toEqual(['3', '2', '1'])
    expect(ids(filterProducts(catalogue, { ...DEFAULT_FILTERS, sort: 'price-desc' }))).toEqual(['1', '2', '3'])
    expect(ids(filterProducts(catalogue, { ...DEFAULT_FILTERS, sort: 'name' }))).toEqual(['3', '1', '2'])
  })
  it('does not change the list it was given', () => {
    const copy = [...catalogue]
    filterProducts(catalogue, { ...DEFAULT_FILTERS, sort: 'price-asc' })
    expect(catalogue).toEqual(copy)
  })
})

describe('categoryCounts / hasActiveFilters', () => {
  it('counts products per category, alphabetically', () => {
    expect(categoryCounts([...catalogue, p({ id: '4', category: 'Textiles' })])).toEqual([
      { category: 'Baskets', count: 1 }, { category: 'Kitchen', count: 1 }, { category: 'Textiles', count: 2 },
    ])
  })
  it('knows when a filter is on', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, inStockOnly: true })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sort: 'price-asc' })).toBe(false)
  })
})

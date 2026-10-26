import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Plus, Check, Search, X } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { useShopProducts } from '@/features/shop/queries'
import { useShopCart } from '@/features/shop/ShopCartContext'
import { useProductRatings } from '@/features/productReviews/queries'
import { RatingBadge } from '@/components/shop/RatingBadge'
import type { ProductRating } from '@/services/shopReviews.service'
import {
  categoryCounts, DEFAULT_FILTERS, filterProducts, hasActiveFilters, SORT_LABELS, type ShopFilters, type ShopSort,
} from '@/features/shop/filter'
import { formatKES } from '@/utils/currency'
import { getResizedImageUrl } from '@/utils/storage'
import type { Product } from '@/types/domain'

function ProductCard({ product, rating }: { product: Product; rating?: ProductRating }) {
  const cart = useShopCart()
  const inCart = cart.lines.find((l) => l.productId === product.id)?.quantity ?? 0
  const soldOut = product.stock < 1
  const hasOptions = (product.product_variants?.length ?? 0) > 0
  const maxed = inCart >= Math.min(product.stock, 20)

  return (
    <article className="flex flex-col overflow-hidden rounded-card bg-sand-50 shadow-card">
      <Link to={`/shop/${product.slug}`} aria-label={`View ${product.name}`} className="block aspect-square bg-sand-200">
        {product.image_path ? (
          <img
            src={getResizedImageUrl('product-images', product.image_path, 600)}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sand-300">
            <ShoppingBag className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs uppercase tracking-wide text-charcoal-500">{product.category}</p>
        <h2 className="font-display text-lg font-medium text-teal-900">
          <Link to={`/shop/${product.slug}`} className="hover:underline">{product.name}</Link>
        </h2>
        <RatingBadge rating={rating} />
        {product.description && <p className="line-clamp-3 text-sm text-charcoal-500">{product.description}</p>}
        <p className="mt-auto pt-2 font-figures text-lg text-teal-900">{formatKES(product.price)}</p>
        <p className="text-xs text-charcoal-500">
          {soldOut ? 'Sold out' : product.stock <= 3 ? `Only ${product.stock} left` : 'In stock'}
        </p>
        {hasOptions && !soldOut ? (
          <Link
            to={`/shop/${product.slug}`}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-teal-900 px-5 py-2.5 text-sm font-medium text-sand-50 transition-colors hover:bg-teal-800"
          >
            Choose colour
          </Link>
        ) : (
          <button
            type="button"
            disabled={soldOut || maxed}
            onClick={() => cart.add(product)}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-teal-900 px-5 py-2.5 text-sm font-medium text-sand-50 transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {inCart > 0 ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {soldOut ? 'Sold out' : inCart > 0 ? `In cart (${inCart}) · add another` : 'Add to cart'}
          </button>
        )}
      </div>
    </article>
  )
}

const selectClass =
  'rounded-lg border border-sand-400 bg-sand-50 px-3 py-2.5 text-base text-charcoal-900 outline-none focus:border-teal-700 sm:text-sm'

export default function Shop() {
  const { data: products, isLoading, isError } = useShopProducts()
  const cart = useShopCart()
  const { data: ratings } = useProductRatings()
  const [filters, setFilters] = useState<ShopFilters>(DEFAULT_FILTERS)

  const categories = useMemo(() => categoryCounts(products ?? []), [products])
  const visible = useMemo(() => filterProducts(products ?? [], filters), [products, filters])
  const filtering = hasActiveFilters(filters)

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <SEO
        title="Shop"
        description="Souvenirs and crafts from the Kenyan Coast. Handed to you during your stay or delivered, paid by M-Pesa."
        path="/shop"
      />

      <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">Shop</h1>
      <p className="mt-2 max-w-2xl text-charcoal-500">
        Souvenirs and crafts from the Kenyan Coast. We can hand your order to you during your stay, or deliver it.
        Pay with M-Pesa.
      </p>

      {cart.count > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-card bg-teal-900/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-charcoal-700">
            <strong>{cart.count}</strong> item{cart.count === 1 ? '' : 's'} in your cart ·{' '}
            <span className="font-figures">{formatKES(cart.subtotal)}</span>
          </p>
          <Link
            to="/shop/checkout"
            className="inline-flex items-center justify-center rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
          >
            View cart and check out
          </Link>
        </div>
      )}

      {isError && (
        <p className="mt-8 rounded-card bg-coral-500/10 p-6 text-sm text-coral-500">
          Something went wrong loading the shop. Please try again.
        </p>
      )}

      {!isError && !isLoading && (products?.length ?? 0) > 0 && (
        <div className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-500" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search the shop"
                placeholder="Search the shop"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className={`${selectClass} w-full pl-9`}
              />
            </div>
            <label className="sr-only" htmlFor="shop-sort">Sort by</label>
            <select
              id="shop-sort"
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value as ShopSort })}
              className={selectClass}
            >
              {(Object.keys(SORT_LABELS) as ShopSort[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[{ category: '', count: products?.length ?? 0, label: 'All' }, ...categories.map((c) => ({ ...c, label: c.category }))].map((c) => {
              const on = filters.category === c.category
              return (
                <button
                  key={c.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilters({ ...filters, category: c.category })}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    on ? 'border-teal-900 bg-teal-900 text-sand-50' : 'border-sand-400 text-charcoal-700 hover:border-teal-800'
                  }`}
                >
                  {c.label} <span className="font-figures text-xs opacity-70">{c.count}</span>
                </button>
              )
            })}
            <label className="ml-auto flex items-center gap-2 text-sm text-charcoal-700">
              <input
                type="checkbox"
                checked={filters.inStockOnly}
                onChange={(e) => setFilters({ ...filters, inStockOnly: e.target.checked })}
              />
              In stock only
            </label>
          </div>

          {filtering && (
            <p className="text-sm text-charcoal-500">
              Showing {visible.length} of {products?.length}.{' '}
              <button type="button" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })} className="inline-flex items-center gap-1 underline">
                <X className="h-3 w-3" aria-hidden="true" /> Clear filters
              </button>
            </p>
          )}
        </div>
      )}

      {!isError && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-80 animate-pulse rounded-card bg-sand-200" />)}
          {visible.map((p) => <ProductCard key={p.id} product={p} rating={ratings?.[p.id]} />)}
        </div>
      )}

      {!isLoading && !isError && (products?.length ?? 0) > 0 && visible.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-card bg-sand-100 py-16 text-center">
          <Search className="h-10 w-10 text-sand-300" aria-hidden="true" />
          <p className="text-charcoal-500">Nothing matches those filters.</p>
          <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="text-sm text-teal-800 underline">Clear filters</button>
        </div>
      )}

      {!isLoading && !isError && products?.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-card bg-sand-100 py-16 text-center">
          <ShoppingBag className="h-10 w-10 text-sand-300" aria-hidden="true" />
          <p className="text-charcoal-500">The shop is being stocked. Please check back soon.</p>
        </div>
      )}
    </div>
  )
}

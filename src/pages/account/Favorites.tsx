import { Link } from 'react-router-dom'
import { Heart, ShoppingBag } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { PropertyCard } from '@/components/property/PropertyCard'
import { PropertyCardSkeleton } from '@/components/property/PropertyCardSkeleton'
import { useAuth } from '@/features/auth/AuthContext'
import { useFavoriteProperties } from '@/features/favorites/queries'
import { useFavoriteActions } from '@/features/favorites/useFavoriteActions'
import { HeartButton } from '@/components/shop/HeartButton'
import { useProductFavoriteIds } from '@/features/productFavorites/queries'
import { useProductFavoriteActions } from '@/features/productFavorites/useProductFavoriteActions'
import { useShopProducts } from '@/features/shop/queries'
import { useShopCart } from '@/features/shop/ShopCartContext'
import { Price } from '@/components/shop/Price'
import { getResizedImageUrl } from '@/utils/storage'

/** The shop items the guest saved, newest first. Items taken off the shop quietly drop out. */
function SavedShopItems() {
  const { user } = useAuth()
  const { data: ids, isLoading: idsLoading } = useProductFavoriteIds(user?.id)
  const { data: products, isLoading: productsLoading } = useShopProducts()
  const favorites = useProductFavoriteActions()
  const cart = useShopCart()

  const byId = new Map((products ?? []).map((p) => [p.id, p]))
  const saved = (ids ?? []).flatMap((id) => {
    const p = byId.get(id)
    return p ? [p] : []
  })
  const loading = idsLoading || productsLoading

  return (
    <section className="mt-14" aria-labelledby="saved-shop-heading">
      <h2 id="saved-shop-heading" className="font-display text-2xl font-medium text-teal-900">Saved from the shop</h2>

      {!loading && saved.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-4 py-10 text-center">
          <ShoppingBag className="h-10 w-10 text-sand-300" aria-hidden="true" />
          <p className="text-charcoal-500">You haven't saved any shop items yet.</p>
          <Link to="/shop" className="rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800">
            Browse the shop
          </Link>
        </div>
      )}

      {saved.length > 0 && (
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {saved.map((p) => {
            const hasOptions = (p.product_variants?.length ?? 0) > 0
            const soldOut = p.stock < 1
            return (
              <li key={p.id} className="relative flex flex-col overflow-hidden rounded-card bg-sand-50 shadow-card">
                <HeartButton saved onToggle={() => favorites.toggle(p.id)} name={p.name} className="absolute right-3 top-3 z-10" />
                <Link to={`/shop/${p.slug}`} aria-label={`View ${p.name}`} className="block aspect-square bg-sand-200">
                  {p.image_path ? (
                    <img src={getResizedImageUrl('product-images', p.image_path, 400)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sand-300"><ShoppingBag className="h-8 w-8" aria-hidden="true" /></span>
                  )}
                </Link>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <Link to={`/shop/${p.slug}`} className="line-clamp-2 text-sm font-medium text-teal-900 hover:underline">{p.name}</Link>
                  <p className="text-sm text-charcoal-700"><Price price={p.price} compareAt={p.compare_at_price} /></p>
                  {soldOut ? (
                    <Link to={`/shop/${p.slug}`} className="mt-auto rounded-full border border-sand-400 px-3 py-2 text-center text-xs font-medium text-charcoal-700 hover:border-teal-800">
                      Sold out · see options
                    </Link>
                  ) : hasOptions ? (
                    <Link to={`/shop/${p.slug}`} className="mt-auto rounded-full border border-teal-900 px-3 py-2 text-center text-xs font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50">
                      Choose colour
                    </Link>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Add ${p.name} to cart`}
                      onClick={() => cart.add(p)}
                      className="mt-auto rounded-full border border-teal-900 px-3 py-2 text-xs font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50"
                    >
                      Add to cart
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {favorites.error && <p role="alert" className="mt-4 text-sm text-coral-500">{favorites.error.message}</p>}
    </section>
  )
}

export default function Favorites() {
  const { user } = useAuth()
  const { data: properties, isLoading, isError } = useFavoriteProperties(user?.id)
  const { isFavorited, handleToggle } = useFavoriteActions()

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <SEO
        title="Your Favorites"
        description="Stays and shop items you've saved at Nataka Holidays."
        noindex
      />

      <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">Your favorites</h1>
      <p className="mt-2 text-charcoal-500">Stays and shop items you've saved for later.</p>
      <h2 className="mt-8 font-display text-2xl font-medium text-teal-900">Saved stays</h2>

      {isError && (
        <p className="mt-8 rounded-card bg-coral-500/10 p-6 text-sm text-coral-500">
          Something went wrong loading your favorites. Please try again.
        </p>
      )}

      {!isError && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <PropertyCardSkeleton key={i} />)}

          {!isLoading && properties?.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-4 py-16 text-center">
              <Heart className="h-10 w-10 text-sand-300" />
              <p className="text-charcoal-500">You haven't saved any properties yet.</p>
              <Link
                to="/holiday-homes"
                className="rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
              >
                Browse holiday homes
              </Link>
            </div>
          )}

          {properties?.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              isFavorited={isFavorited(property.id)}
              onToggleFavorite={handleToggle}
            />
          ))}
        </div>
      )}

      <SavedShopItems />
    </div>
  )
}

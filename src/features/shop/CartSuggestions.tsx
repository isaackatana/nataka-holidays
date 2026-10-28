import { Link } from 'react-router-dom'
import { Plus, ShoppingBag } from 'lucide-react'
import { useRelatedProducts, useShopProducts } from '@/features/shop/queries'
import { useShopCart } from '@/features/shop/ShopCartContext'
import { formatKES } from '@/utils/currency'
import { getResizedImageUrl } from '@/utils/storage'

/** "You might also like": products often bought with what is in the cart, then similar ones. One tap to add. */
export function CartSuggestions() {
  const cart = useShopCart()
  const productIds = cart.lines.map((l) => l.productId)
  const { data: related } = useRelatedProducts(productIds)
  const { data: products } = useShopProducts()

  const byId = new Map((products ?? []).map((p) => [p.id, p]))
  const suggestions = (related ?? []).flatMap((r) => {
    const product = byId.get(r.product_id)
    return product ? [{ product, together: r.together }] : []
  })
  if (suggestions.length === 0) return null

  return (
    <section className="mt-8" aria-labelledby="suggestions-heading">
      <h2 id="suggestions-heading" className="font-display text-lg font-medium text-teal-900">You might also like</h2>
      <ul className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        {suggestions.map(({ product, together }) => {
          const hasOptions = (product.product_variants?.length ?? 0) > 0
          return (
            <li key={product.id} className="flex flex-col overflow-hidden rounded-card bg-sand-50 shadow-card">
              <Link to={`/shop/${product.slug}`} aria-label={`View ${product.name}`} className="block aspect-square bg-sand-200">
                {product.image_path ? (
                  <img src={getResizedImageUrl('product-images', product.image_path, 400)} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sand-300"><ShoppingBag className="h-8 w-8" aria-hidden="true" /></span>
                )}
              </Link>
              <div className="flex flex-1 flex-col gap-1 p-3">
                {together > 0 && <p className="text-[11px] font-medium uppercase tracking-wide text-teal-800">Often bought together</p>}
                <Link to={`/shop/${product.slug}`} className="line-clamp-2 text-sm font-medium text-teal-900 hover:underline">{product.name}</Link>
                <p className="font-figures text-sm text-charcoal-700">{formatKES(product.price)}</p>
                {hasOptions ? (
                  <Link to={`/shop/${product.slug}`} className="mt-auto inline-flex items-center justify-center rounded-full border border-teal-900 px-3 py-2 text-xs font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50">
                    Choose colour
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-label={`Add ${product.name} to cart`}
                    onClick={() => cart.add(product)}
                    className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-teal-900 px-3 py-2 text-xs font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

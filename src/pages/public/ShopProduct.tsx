import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Link2, MessageCircle, Minus, Plus, Share2, ShoppingBag, Truck, HandHelping } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { JsonLd } from '@/components/shared/JsonLd'
import { Gallery } from '@/components/property/Gallery'
import { useShopProduct, useShopProducts } from '@/features/shop/queries'
import { useShopCart } from '@/features/shop/ShopCartContext'
import { useProductRatings } from '@/features/productReviews/queries'
import { RatingBadge } from '@/components/shop/RatingBadge'
import { ProductReviewsSection } from '@/components/shop/ProductReviewsSection'
import { MAX_PER_LINE } from '@/features/shop/cart'
import { formatKES } from '@/utils/currency'
import { getPublicImageUrl, getResizedImageUrl } from '@/utils/storage'
import { SITE_ORIGIN } from '@/utils/siteUrl'
import { buildProductEnquiryMessage, buildWhatsAppLink, buildWhatsAppShareLink } from '@/utils/whatsapp'
import type { Product, ProductWithImages } from '@/types/domain'

function stockLabel(stock: number): string {
  if (stock < 1) return 'Sold out'
  return stock <= 3 ? `Only ${stock} left` : 'In stock'
}

function Buy({ product }: { product: ProductWithImages }) {
  const cart = useShopCart()
  const [qty, setQty] = useState(1)
  const [variantId, setVariantId] = useState<string | null>(null)
  const options = product.product_variants
  const hasOptions = options.length > 0
  const variant = options.find((v) => v.id === variantId)
  const needsChoice = hasOptions && !variant

  const available = variant ? variant.stock : product.stock
  const key = variant ? variant.id : product.id
  const inCart = cart.lines.find((l) => l.key === key)?.quantity ?? 0
  const room = needsChoice ? 0 : Math.max(0, Math.min(available, MAX_PER_LINE) - inCart)
  const soldOut = product.stock < 1
  const wanted = Math.min(qty, Math.max(room, 1))

  return (
    <div className="mt-6 flex flex-col gap-4">
      {hasOptions && (
        <div role="radiogroup" aria-labelledby="option-label" className="flex flex-col gap-2">
          <span className="text-sm font-medium text-charcoal-700" id="option-label">
            Colour{variant ? `: ${variant.name}` : ''}
          </span>
          <div className="flex flex-wrap gap-2">
            {options.map((v) => {
              const on = v.id === variantId
              const out = v.stock < 1
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={out}
                  onClick={() => { setVariantId(v.id); setQty(1) }}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-50 ${
                    on ? 'border-teal-900 bg-teal-900 text-sand-50' : 'border-sand-400 text-charcoal-700 hover:border-teal-800'
                  }`}
                >
                  {v.name}{out ? ' (sold out)' : ''}
                </button>
              )
            })}
          </div>
          {variant && variant.stock >= 1 && variant.stock <= 3 && (
            <p className="text-sm text-charcoal-500">Only {variant.stock} left in {variant.name}</p>
          )}
        </div>
      )}

      {!soldOut && room > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-charcoal-700" id="qty-label">Quantity</span>
          <div role="group" aria-labelledby="qty-label" className="flex items-center rounded-full border border-sand-400">
            <button
              type="button"
              aria-label="One fewer"
              disabled={wanted <= 1}
              onClick={() => setQty(wanted - 1)}
              className="flex h-10 w-10 items-center justify-center text-charcoal-700 hover:text-teal-800 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="w-8 text-center font-figures" aria-live="polite">{wanted}</span>
            <button
              type="button"
              aria-label="One more"
              disabled={wanted >= room}
              onClick={() => setQty(wanted + 1)}
              className="flex h-10 w-10 items-center justify-center text-charcoal-700 hover:text-teal-800 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={soldOut || room < 1}
        onClick={() => {
          cart.add(product, wanted, variant ? { id: variant.id, name: variant.name, stock: variant.stock } : undefined)
          setQty(1)
        }}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-900 px-6 py-3 text-sm font-medium text-sand-50 transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {inCart > 0 ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        {soldOut
          ? 'Sold out'
          : needsChoice
            ? 'Choose a colour'
            : room < 1
              ? 'All available are in your cart'
              : inCart > 0 ? `In cart (${inCart}) · add ${wanted} more` : 'Add to cart'}
      </button>

      {cart.count > 0 && (
        <Link to="/shop/checkout" className="text-sm font-medium text-teal-800 underline">
          View cart and check out
        </Link>
      )}
    </div>
  )
}

function ShareAndAsk({ product }: { product: Product }) {
  const [copied, setCopied] = useState(false)
  const url = `${SITE_ORIGIN}/shop/${product.slug}`
  const linkClass =
    'inline-flex items-center gap-2 rounded-full border border-sand-400 px-4 py-2 text-sm text-charcoal-700 hover:border-teal-800 hover:text-teal-800'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the WhatsApp share still works.
    }
  }

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <a href={buildWhatsAppLink(buildProductEnquiryMessage(product.name, url))} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <MessageCircle className="h-4 w-4" aria-hidden="true" /> Ask about this
      </a>
      <a href={buildWhatsAppShareLink(`${product.name} from Nataka Holidays: ${url}`)} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <Share2 className="h-4 w-4" aria-hidden="true" /> Share on WhatsApp
      </a>
      <button type="button" onClick={copy} className={linkClass}>
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  )
}

function RelatedProducts({ product }: { product: Product }) {
  const { data: all } = useShopProducts()
  const related = (all ?? []).filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)
  if (related.length === 0) return null
  return (
    <section className="mt-16" aria-labelledby="related-heading">
      <h2 id="related-heading" className="font-display text-xl font-medium text-teal-900">More {product.category.toLowerCase()}</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {related.map((p) => (
          <Link key={p.id} to={`/shop/${p.slug}`} className="group overflow-hidden rounded-card bg-sand-50 shadow-card">
            <div className="flex aspect-square items-center justify-center bg-sand-200 text-sand-300">
              {p.image_path ? (
                <img src={getResizedImageUrl('product-images', p.image_path, 400)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <ShoppingBag className="h-8 w-8" aria-hidden="true" />
              )}
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-sm font-medium text-teal-900">{p.name}</p>
              <p className="mt-1 font-figures text-sm text-charcoal-700">{formatKES(p.price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default function ShopProduct() {
  const { slug } = useParams()
  const { data: product, isLoading, isError } = useShopProduct(slug)
  const { data: ratings } = useProductRatings()

  if (isLoading) {
    return <div className="mx-auto max-w-6xl px-6 py-24 text-charcoal-500">Loading...</div>
  }

  if (isError || !product) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
        <SEO title="Product not found" description="This product is not in the shop." noindex />
        <ShoppingBag className="h-10 w-10 text-sand-300" aria-hidden="true" />
        <h1 className="font-display text-2xl font-medium text-teal-900">
          {isError ? 'Something went wrong' : 'We could not find that product'}
        </h1>
        <p className="text-charcoal-500">
          {isError ? 'Please try again in a moment.' : 'It may have sold out for good or been taken off the shop.'}
        </p>
        <Link to="/shop" className="rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800">
          Back to the shop
        </Link>
      </div>
    )
  }

  // Products saved before galleries existed only have a cover photo.
  const images = product.product_images.length > 0
    ? product.product_images
    : product.image_path ? [{ id: 'cover', product_id: product.id, storage_path: product.image_path, sort_order: 0 }] : []
  const cover = images[0] ? getPublicImageUrl('product-images', images[0].storage_path) : undefined
  const description = product.description.trim() || `${product.name} from the Kenyan Coast, from the Nataka Holidays shop.`

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    category: product.category,
    ...(images.length > 0 && { image: images.map((i) => getPublicImageUrl('product-images', i.storage_path)) }),
    ...(ratings?.[product.id] && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: ratings[product.id].average,
        reviewCount: ratings[product.id].review_count,
      },
    }),
    offers: {
      '@type': 'Offer',
      url: `${SITE_ORIGIN}/shop/${product.slug}`,
      priceCurrency: 'KES',
      price: product.price,
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <SEO title={product.name} description={description.slice(0, 160)} image={cover} path={`/shop/${product.slug}`} />
      <JsonLd data={structuredData} />

      <Link to="/shop" className="flex items-center gap-1.5 text-sm text-charcoal-500 hover:text-teal-800">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to the shop
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <Gallery images={images} title={product.name} bucket="product-images" />
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-charcoal-500">{product.category}</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-teal-900 md:text-4xl">{product.name}</h1>
          <div className="mt-2"><RatingBadge rating={ratings?.[product.id]} /></div>
          <p className="mt-3 font-figures text-2xl text-teal-900">{formatKES(product.price)}</p>
          <p className={`mt-1 text-sm ${product.stock < 1 ? 'text-coral-500' : 'text-charcoal-500'}`}>{stockLabel(product.stock)}</p>

          {product.description.trim() && (
            <p className="mt-5 whitespace-pre-line text-charcoal-700">{product.description}</p>
          )}

          <Buy key={product.id} product={product} />
          <ShareAndAsk product={product} />

          <ul className="mt-8 flex flex-col gap-3 rounded-card bg-sand-100 p-5 text-sm text-charcoal-700">
            <li className="flex items-start gap-3">
              <HandHelping className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" aria-hidden="true" />
              Hand-over: we bring it to you during your stay, at no extra cost.
            </li>
            <li className="flex items-start gap-3">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" aria-hidden="true" />
              Delivery: one flat fee for the whole order, shown at checkout.
            </li>
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" aria-hidden="true" />
              Pay securely with M-Pesa when you check out.
            </li>
          </ul>
        </div>
      </div>

      <ProductReviewsSection productId={product.id} />

      <RelatedProducts product={product} />
    </div>
  )
}

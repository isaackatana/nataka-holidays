import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  MapPin,
  Users,
  BedDouble,
  Bath,
  Share2,
  Link2,
  Check,
  MessageCircle,
  Phone,
  Clock,
} from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { JsonLd } from '@/components/shared/JsonLd'
import { Gallery } from '@/components/property/Gallery'
import { AmenitiesList } from '@/components/property/AmenitiesList'
import { PropertyMap } from '@/components/property/PropertyMap'
import { BookingEnquiryForm } from '@/components/property/BookingEnquiryForm'
import { ReviewsSection } from '@/components/property/ReviewsSection'
import { PropertyCard } from '@/components/property/PropertyCard'
import { PropertyCardSkeleton } from '@/components/property/PropertyCardSkeleton'
import { usePropertyBySlug, useRelatedProperties } from '@/features/properties/queries'
import { useApprovedReviews } from '@/features/reviews/queries'
import { useFavoriteActions } from '@/features/favorites/useFavoriteActions'
import { useBusinessSettings } from '@/features/settings/queries'
import { getPublicImageUrl } from '@/utils/storage'
import { buildWhatsAppLink, buildPropertyEnquiryMessage } from '@/utils/whatsapp'


export default function PropertyDetails() {
  const { slug } = useParams()
  const { data: property, isLoading, isError } = usePropertyBySlug(slug)
  const { data: related, isLoading: relatedLoading } = useRelatedProperties(property)
  const { isFavorited, handleToggle } = useFavoriteActions()
  const { data: businessSettings } = useBusinessSettings()
  // Called unconditionally (Rules of Hooks) even though property may still
  // be loading — `enabled: !!propertyId` inside the hook itself handles
  // that, and this reuses the same React Query cache entry ReviewsSection
  // populates below, so it's not a second network round trip.
  const { data: approvedReviews } = useApprovedReviews(property?.id)
  const businessPhone = businessSettings?.contact_phone
  // tel: links need digits/plus only — strip spaces from whatever an
  // admin typed into Settings so "+254 700 000 000" still dials correctly.
  const businessPhoneTel = businessPhone?.replace(/\s+/g, '')
  const [linkCopied, setLinkCopied] = useState(false)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="h-[420px] w-full animate-pulse rounded-card bg-sand-200" />
      </div>
    )
  }

  if (isError || !property) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-start justify-center gap-4 px-6">
        <h1 className="font-display text-3xl font-medium text-teal-900">Property not found</h1>
        <p className="text-charcoal-500">
          This listing may have been unpublished or the link may be incorrect.
        </p>
        <Link
          to="/holiday-homes"
          className="rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
        >
          Browse holiday homes
        </Link>
      </div>
    )
  }

  const propertyUrl = `${window.location.origin}/stays/${property.slug}`
  const primaryImagePath = property.property_images?.find((i) => i.is_primary)?.storage_path
  const primaryImageUrl = primaryImagePath ? getPublicImageUrl('property-images', primaryImagePath) : undefined

  const averageRating =
    approvedReviews && approvedReviews.length > 0
      ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
      : undefined

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: property.title,
    description: property.description,
    url: propertyUrl,
    ...(primaryImageUrl && { image: [primaryImageUrl] }),
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.location,
      addressCountry: 'KE',
    },
    ...(property.latitude &&
      property.longitude && {
        geo: {
          '@type': 'GeoCoordinates',
          latitude: property.latitude,
          longitude: property.longitude,
        },
      }),
    priceRange: `KES ${property.price_per_night} per night`,
    ...(property.amenities &&
      property.amenities.length > 0 && {
        amenityFeature: property.amenities.map((a) => ({
          '@type': 'LocationFeatureSpecification',
          name: a.name,
        })),
      }),
    ...(averageRating !== undefined && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: averageRating.toFixed(1),
        reviewCount: approvedReviews!.length,
      },
    }),
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: property!.title, url: propertyUrl })
      } catch {
        // user cancelled the native share sheet — nothing to do
      }
    } else {
      await handleCopyLink()
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(propertyUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <div className="pb-20">
      <SEO
        title={property.title}
        description={property.description.slice(0, 155)}
        path={`/stays/${property.slug}`}
        image={primaryImageUrl}
      />
      <JsonLd data={structuredData} />

      <div className="mx-auto max-w-7xl px-6 pt-8">
        <Gallery images={property.property_images ?? []} title={property.title} bucket="property-images" />

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
          {/* ---------------- MAIN COLUMN ---------------- */}
          <div className="flex flex-col gap-10">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">
                    {property.title}
                  </h1>
                  <p className="mt-2 flex items-center gap-1.5 text-charcoal-500">
                    <MapPin className="h-4 w-4" />
                    {property.location}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={handleShare}
                    aria-label="Share this property"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-sand-300 text-charcoal-700 hover:bg-sand-100"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCopyLink}
                    aria-label="Copy property link"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-sand-300 text-charcoal-700 hover:bg-sand-100"
                  >
                    {linkCopied ? <Check className="h-4 w-4 text-teal-700" /> : <Link2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-6 border-y border-sand-200 py-5 text-charcoal-700">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-teal-700" />
                  {property.max_guests} guests
                </span>
                <span className="flex items-center gap-2">
                  <BedDouble className="h-5 w-5 text-teal-700" />
                  {property.bedrooms} bedroom{property.bedrooms === 1 ? '' : 's'}
                </span>
                <span className="flex items-center gap-2">
                  <Bath className="h-5 w-5 text-teal-700" />
                  {property.bathrooms} bathroom{property.bathrooms === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div>
              <h2 className="font-display text-xl font-medium text-teal-900">About this home</h2>
              <p className="mt-3 whitespace-pre-line text-charcoal-700">{property.description}</p>
            </div>

            {property.amenities && property.amenities.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-medium text-teal-900">Amenities</h2>
                <div className="mt-4">
                  <AmenitiesList amenities={property.amenities} />
                </div>
              </div>
            )}

            <div>
              <h2 className="font-display text-xl font-medium text-teal-900">Check-in &amp; house rules</h2>
              <div className="mt-4 flex flex-wrap gap-6 text-sm text-charcoal-700">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-teal-700" />
                  Check-in after {property.check_in_time}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-teal-700" />
                  Check-out before {property.check_out_time}
                </span>
              </div>
              {property.house_rules && (
                <p className="mt-3 whitespace-pre-line text-sm text-charcoal-500">{property.house_rules}</p>
              )}
            </div>

            {(property.latitude !== null || property.longitude !== null) && (
              <div>
                <h2 className="font-display text-xl font-medium text-teal-900">Location</h2>
                <div className="mt-4">
                  <PropertyMap
                    latitude={property.latitude}
                    longitude={property.longitude}
                    title={property.title}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-card bg-sand-100 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-lg font-medium text-teal-900">Managed by Nataka Holidays</h3>
                <p className="mt-1 text-sm text-charcoal-500">
                  Local guest services, verified listings, real people on WhatsApp.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={buildWhatsAppLink(buildPropertyEnquiryMessage(property.title, propertyUrl))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-full bg-teal-900 px-4 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                {businessPhoneTel && (
                  <a
                    href={`tel:${businessPhoneTel}`}
                    className="flex items-center gap-2 rounded-full border border-teal-900 px-4 py-2.5 text-sm font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50"
                  >
                    <Phone className="h-4 w-4" />
                    Call
                  </a>
                )}
              </div>
            </div>
            {businessPhone && <p className="-mt-6 text-xs text-charcoal-400">{businessPhone}</p>}

            <div>
              <h2 className="font-display text-xl font-medium text-teal-900">Reviews</h2>
              <div className="mt-4">
                <ReviewsSection propertyId={property.id} />
              </div>
            </div>
          </div>

          {/* ---------------- BOOKING SIDEBAR ---------------- */}
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <BookingEnquiryForm property={property} />
          </div>
        </div>

        {/* ---------------- RELATED PROPERTIES ---------------- */}
        {(relatedLoading || (related && related.length > 0)) && (
          <div className="mt-16">
            <h2 className="font-display text-2xl font-medium text-teal-900">You may also like</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedLoading &&
                Array.from({ length: 3 }).map((_, i) => <PropertyCardSkeleton key={i} />)}
              {related?.map((p) => (
                <PropertyCard
                  key={p.id}
                  property={p}
                  isFavorited={isFavorited(p.id)}
                  onToggleFavorite={handleToggle}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, MapPin, MessageCircle } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { JsonLd } from '@/components/shared/JsonLd'
import { Gallery } from '@/components/property/Gallery'
import { useExperienceBySlug } from '@/features/experiences/queries'
import { getPublicImageUrl } from '@/utils/storage'
import { formatKES } from '@/utils/currency'
import { buildWhatsAppLink, buildExperienceEnquiryMessage } from '@/utils/whatsapp'

export default function ExperienceDetails() {
  const { slug } = useParams()
  const { data: experience, isLoading, isError } = useExperienceBySlug(slug)

  if (isLoading) {
    return <div className="mx-auto max-w-4xl px-6 py-24 text-charcoal-500">Loading...</div>
  }

  if (isError || !experience) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-24">
        <h1 className="font-display text-3xl font-medium text-teal-900">Experience not found</h1>
        <Link to="/experiences" className="text-teal-800 hover:underline">
          Back to all experiences
        </Link>
      </div>
    )
  }

  const primaryImage = experience.experience_images?.[0]
  const imageUrl = primaryImage ? getPublicImageUrl('experience-images', primaryImage.storage_path) : null
  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: experience.title,
    description: experience.description,
    url: pageUrl,
    ...(imageUrl && { image: [imageUrl] }),
    ...(experience.location && {
      touristType: 'Leisure',
      itinerary: { '@type': 'Place', name: experience.location },
    }),
    ...(experience.price !== null && {
      offers: {
        '@type': 'Offer',
        priceCurrency: 'KES',
        price: experience.price,
      },
    }),
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <SEO
        title={experience.title}
        description={experience.description.slice(0, 155)}
        path={`/experiences/${experience.slug}`}
        image={imageUrl ?? undefined}
      />
      <JsonLd data={structuredData} />

      <Link to="/experiences" className="flex items-center gap-1.5 text-sm text-charcoal-500 hover:text-teal-800">
        <ArrowLeft className="h-4 w-4" />
        Back to experiences
      </Link>

      <div className="mt-4">
        <Gallery
          images={experience.experience_images ?? []}
          title={experience.title}
          bucket="experience-images"
        />
      </div>

      <h1 className="mt-6 font-display text-3xl font-medium text-teal-900 md:text-4xl">
        {experience.title}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-charcoal-600">
        {experience.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {experience.location}
          </span>
        )}
        {experience.duration && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {experience.duration}
          </span>
        )}
        {experience.price !== null && (
          <span className="font-figures font-medium text-teal-900">{formatKES(experience.price)}</span>
        )}
      </div>

      <p className="mt-6 whitespace-pre-line text-charcoal-700">{experience.description}</p>

      <a
        href={buildWhatsAppLink(buildExperienceEnquiryMessage(experience.title, pageUrl))}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 flex w-fit items-center gap-2 rounded-full bg-teal-900 px-6 py-3 text-sm font-medium text-sand-50 transition-transform hover:scale-105"
      >
        <MessageCircle className="h-4 w-4" />
        Ask about this on WhatsApp
      </a>
    </div>
  )
}

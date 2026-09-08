import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, MapPin, MessageCircle, Briefcase, Check } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { JsonLd } from '@/components/shared/JsonLd'
import { Gallery } from '@/components/property/Gallery'
import { VideoEmbed } from '@/components/shared/VideoEmbed'
import { useExperienceBySlug } from '@/features/experiences/queries'
import { useTripCart } from '@/features/tripCart/TripCartContext'
import { getPublicImageUrl } from '@/utils/storage'
import { formatKES } from '@/utils/currency'
import { buildWhatsAppLink, buildExperienceEnquiryMessage } from '@/utils/whatsapp'

export default function ExperienceDetails() {
  const { slug } = useParams()
  const { data: experience, isLoading, isError } = useExperienceBySlug(slug)
  const { addExperience, removeExperience, isExperienceInCart } = useTripCart()
  // Called unconditionally (before the early returns below) per Rules of
  // Hooks — safe even while `experience` is still undefined, since
  // isExperienceInCart just checks membership in a local array.
  const inTrip = isExperienceInCart(experience?.id ?? '')

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

      {experience.video_url && (
        <div className="mt-8">
          <h2 className="font-display text-xl font-medium text-teal-900">Video</h2>
          <div className="mt-4">
            <VideoEmbed url={experience.video_url} title={`${experience.title} video`} />
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={buildWhatsAppLink(buildExperienceEnquiryMessage(experience.title, pageUrl))}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-2 rounded-full bg-teal-900 px-6 py-3 text-sm font-medium text-sand-50 transition-transform hover:scale-105"
        >
          <MessageCircle className="h-4 w-4" />
          Ask about this on WhatsApp
        </a>

        <button
          onClick={() =>
            inTrip
              ? removeExperience(experience.id)
              : addExperience({
                  id: experience.id,
                  title: experience.title,
                  slug: experience.slug,
                  price: experience.price,
                })
          }
          className={`flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-medium transition-colors ${
            inTrip
              ? 'border-teal-800 bg-teal-800 text-sand-50'
              : 'border-teal-900 text-teal-900 hover:bg-teal-900 hover:text-sand-50'
          }`}
        >
          {inTrip ? <Check className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
          {inTrip ? 'Added to trip' : 'Add to trip'}
        </button>
      </div>
    </div>
  )
}

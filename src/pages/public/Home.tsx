import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { JsonLd } from '@/components/shared/JsonLd'
import { SITE_ORIGIN } from '@/utils/siteUrl'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { SearchBar } from '@/components/property/SearchBar'
import { PropertyCard } from '@/components/property/PropertyCard'
import { PropertyCardSkeleton } from '@/components/property/PropertyCardSkeleton'
import { ExperienceCard } from '@/components/property/ExperienceCard'
import { useFeaturedProperties } from '@/features/properties/queries'
import { useExperiences } from '@/features/experiences/queries'
import { useFavoriteActions } from '@/features/favorites/useFavoriteActions'
import { useBusinessSettings } from '@/features/settings/queries'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { DESTINATIONS } from '@/data/destinations'
import { WHY_CHOOSE_US, WHY_CHOOSE_US_ICONS, TESTIMONIALS } from '@/data/content'
import { buildWhatsAppLink } from '@/utils/whatsapp'

export default function Home() {
  const { data: featuredProperties, isLoading: featuredLoading } = useFeaturedProperties(6)
  const { data: experiences, isLoading: experiencesLoading } = useExperiences(3)
  const { isFavorited, handleToggle } = useFavoriteActions()
  const { data: businessSettings } = useBusinessSettings()
  const prefersReducedMotion = usePrefersReducedMotion()
  const socialLinks = [businessSettings?.instagram_url, businessSettings?.facebook_url].filter(
    (url): url is string => !!url,
  )

  return (
    <div className="flex flex-col">
      <SEO
        title="Villas & Beach Houses in Diani, Kenya"
        description="Premium villas, apartments and beach houses in Diani Beach, Kenya. Browse holiday homes, check availability and book your Kenyan Coast getaway."
        path="/"
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Nataka Holidays',
          url: SITE_ORIGIN,
          areaServed: 'Diani Beach, Kenya',
          sameAs: socialLinks,
        }}
      />

      {/* ---------------- HERO ---------------- */}
      <section className="relative flex min-h-[85vh] flex-col justify-end overflow-hidden px-6 pb-16 pt-32 text-sand-50">
        {businessSettings?.hero_video_url && !prefersReducedMotion ? (
          // Always a direct file URL, not a YouTube/Vimeo link (see the
          // admin Settings guidance) — a background video needs to
          // autoplay muted and loop seamlessly with no player chrome,
          // which those platforms' iframe embeds aren't built for.
          //
          // Gated on !prefersReducedMotion: CSS's own reduced-motion
          // media query (index.css) only affects animation/transition
          // properties — it has no effect on a <video autoPlay> element,
          // so a full-bleed autoplaying background video needs this
          // explicit check. Falls back to the static poster/hero image
          // below instead of just not rendering anything.
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={businessSettings.hero_image_url ?? undefined}
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src={businessSettings.hero_video_url} />
          </video>
        ) : businessSettings?.hero_image_url ? (
          <img
            src={businessSettings.hero_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}

        {/* Solid gradient when there's no media actually rendered behind
            it (the original design, unchanged) — translucent instead
            when layered over a real video/image, so it still keeps the
            text readable without hiding the media entirely. Checks the
            same condition that decided what rendered above, not just
            whether hero_video_url is set — a reduced-motion visitor
            with only a hero video configured (no fallback image) has
            nothing rendered behind this overlay, and a translucent
            gradient over nothing would look broken, not just dimmer. */}
        <div
          className={
            (businessSettings?.hero_video_url && !prefersReducedMotion) || businessSettings?.hero_image_url
              ? 'absolute inset-0 bg-gradient-to-b from-teal-950/90 via-teal-900/55 to-teal-800/35'
              : 'absolute inset-0 bg-gradient-to-b from-teal-950 via-teal-900 to-teal-800'
          }
        />

        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-gold-400">
            Diani Beach &middot; Kenyan Coast
          </span>
          <h1 className="max-w-3xl font-display text-5xl font-medium leading-[1.05] md:text-6xl">
            Holiday homes on Kenya's most celebrated coastline.
          </h1>
          <p className="max-w-xl text-lg text-sand-200">
            Villas, apartments and beach houses in Diani Beach — verified, locally managed,
            and a real person on WhatsApp when you need one.
          </p>
        </div>

        <div className="relative mx-auto mt-10 w-full max-w-5xl">
          <SearchBar />
        </div>
      </section>

      <span className="tideline" />

      {/* ---------------- FEATURED HOLIDAY HOMES ---------------- */}
      <section className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Handpicked"
            title="Featured holiday homes"
            description="A selection of our most-loved villas, cottages and apartments along the coast."
          />
          <Link
            to="/holiday-homes"
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-teal-800 hover:underline md:flex"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredLoading &&
            Array.from({ length: 3 }).map((_, i) => <PropertyCardSkeleton key={i} />)}

          {!featuredLoading && featuredProperties?.length === 0 && (
            <p className="col-span-full text-charcoal-500">
              No featured properties yet — check back soon, or browse{' '}
              <Link to="/holiday-homes" className="text-teal-800 underline">
                all holiday homes
              </Link>
              .
            </p>
          )}

          {featuredProperties?.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              isFavorited={isFavorited(property.id)}
              onToggleFavorite={handleToggle}
            />
          ))}
        </div>

        <Link
          to="/holiday-homes"
          className="mt-8 flex items-center justify-center gap-1 text-sm font-medium text-teal-800 hover:underline md:hidden"
        >
          View all holiday homes <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* ---------------- WHY CHOOSE NATAKA ---------------- */}
      <section className="bg-teal-950 px-6 py-20 text-sand-50">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Why Nataka"
            title="Booked with confidence, not guesswork"
            align="center"
          />
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_CHOOSE_US.map((item) => {
              const Icon = WHY_CHOOSE_US_ICONS[item.icon]
              return (
                <div key={item.title} className="flex flex-col items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-800">
                    <Icon className="h-5 w-5 text-gold-400" />
                  </div>
                  <h3 className="font-display text-lg font-medium">{item.title}</h3>
                  <p className="text-sm text-sand-300">{item.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---------------- DIANI BEACH INTRODUCTION ---------------- */}
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-20 md:flex-row md:items-center">
        <div className="flex-1">
          <SectionHeading eyebrow="The Kenyan Coast" title="Diani Beach" />
          <p className="mt-4 text-charcoal-700">
            Diani stretches for roughly 17 kilometres along the Indian Ocean south of Mombasa —
            white coral sand, warm water year-round, and a reef that keeps the surf gentle close
            to shore. It's long been one of East Africa's best-known beach destinations, with a
            relaxed pace shaped as much by the local Digo and Swahili coastal culture as by the
            visitors who return year after year.
          </p>
          <p className="mt-4 text-charcoal-700">
            Beyond the beach itself: the Colobus Conservation forest reserve, dhow trips to
            Wasini and Kisite Marine Park, kite surfing at Galu when the winds are up, and a
            growing food scene from beach shacks to fine dining.
          </p>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-4">
            {DESTINATIONS.map((destination) => (
              <div
                key={destination.name}
                className="flex aspect-square flex-col justify-end rounded-card bg-gradient-to-br from-teal-700 to-teal-950 p-4 text-sand-50"
              >
                <span className="font-display text-base font-medium">{destination.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <span className="tideline" />

      {/* ---------------- POPULAR EXPERIENCES ---------------- */}
      <section className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Beyond the villa"
            title="Popular experiences"
            description="Local trips and activities we can arrange alongside your stay."
          />
          <Link
            to="/experiences"
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-teal-800 hover:underline md:flex"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {experiencesLoading &&
            Array.from({ length: 3 }).map((_, i) => <PropertyCardSkeleton key={i} />)}
          {experiences?.map((experience) => (
            <ExperienceCard key={experience.id} experience={experience} />
          ))}
        </div>
      </section>

      {/* ---------------- GUEST TESTIMONIALS ---------------- */}
      <section className="mx-auto w-full max-w-7xl px-6 py-20">
        <SectionHeading eyebrow="Guest stories" title="What guests are saying" align="center" />
        <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-4 rounded-card bg-sand-100 p-8 text-center">
          <p className="font-display text-lg italic text-charcoal-700">
            "{TESTIMONIALS[0].quote}"
          </p>
        </div>
      </section>

      {/* ---------------- CTA / WHATSAPP ---------------- */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-20">
        <div className="flex flex-col items-start gap-6 rounded-card bg-gold-500 p-10 text-teal-950 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-medium md:text-3xl">
              Not sure which home is right for you?
            </h2>
            <p className="mt-2 max-w-xl text-teal-950/80">
              Tell us your dates and group size on WhatsApp — we'll point you to the right
              property directly.
            </p>
          </div>
          <a
            href={buildWhatsAppLink('Hello Nataka Holidays, I would like help choosing a property.')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-2 rounded-full bg-teal-950 px-6 py-3 text-sm font-medium text-sand-50 transition-transform hover:scale-105"
          >
            <MessageCircle className="h-4 w-4" />
            Chat on WhatsApp
          </a>
        </div>
      </section>
    </div>
  )
}

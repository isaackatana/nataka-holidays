import { MessageCircle } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { ExperienceCard } from '@/components/property/ExperienceCard'
import { useExperiences } from '@/features/experiences/queries'
import { buildWhatsAppLink } from '@/utils/whatsapp'

/**
 * Content-light for now — a real static page rather than a placeholder,
 * but not backed by its own admin-managed data model. Matches airport
 * transfer / car hire / transport-related experiences that already exist
 * in the `experiences` table (e.g. the seeded "Airport Transfer" entry)
 * by keyword rather than duplicating that content here statically, so it
 * stays live if an admin adds or edits a real transport experience later.
 * If this needs its own bookable, admin-managed structure (pricing tiers,
 * vehicle types, routes) rather than living under Experiences, that's a
 * real schema addition — flag it and it can be built out properly.
 */
const TRANSPORT_KEYWORDS = ['transfer', 'transport', 'taxi', 'car hire', 'shuttle', 'pickup']

export default function Transport() {
  const { data: experiences } = useExperiences()

  const transportExperiences = (experiences ?? []).filter((exp) =>
    TRANSPORT_KEYWORDS.some(
      (kw) => exp.title.toLowerCase().includes(kw) || exp.description.toLowerCase().includes(kw),
    ),
  )

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <SEO
        title="Transport"
        description="Airport transfers and getting around Diani Beach with Nataka Holidays."
        path="/transport"
      />

      <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">Transport</h1>

      <p className="mt-4 text-lg text-charcoal-700">
        Getting to and around Diani is easy to arrange alongside your stay — airport transfers,
        car hire, and local drivers who know the coast.
      </p>

      <div className="mt-6 flex flex-col gap-4 text-charcoal-700">
        <p>
          Moi International Airport (MBA) in Mombasa is around 45–60 minutes from Diani Beach by
          road, including the Likoni ferry crossing. We can arrange a private transfer timed to
          your flight, or point you toward a reliable driver for day trips along the coast.
        </p>
        <p>
          Tell us your flight details or where you're headed and we'll sort the rest — message us
          on WhatsApp and we'll confirm pricing and pickup times directly.
        </p>
      </div>

      <a
        href={buildWhatsAppLink('Hello Nataka Holidays, I would like to arrange transport.')}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 flex w-fit items-center gap-2 rounded-full bg-teal-900 px-6 py-3 text-sm font-medium text-sand-50 transition-transform hover:scale-105"
      >
        <MessageCircle className="h-4 w-4" />
        Arrange transport on WhatsApp
      </a>

      {transportExperiences.length > 0 && (
        <div className="mt-12">
          <SectionHeading eyebrow="Bookable now" title="Transport experiences" />
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {transportExperiences.map((experience) => (
              <ExperienceCard key={experience.id} experience={experience} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

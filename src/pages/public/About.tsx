import { Link } from 'react-router-dom'
import { SEO } from '@/components/shared/SEO'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { WHY_CHOOSE_US, WHY_CHOOSE_US_ICONS } from '@/data/content'
import { useBusinessSettings } from '@/features/settings/queries'

export default function About() {
  const { data: settings } = useBusinessSettings()

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <SEO
        title="About Us"
        description="Nataka Holidays is a locally-run holiday rental business on the Kenyan Coast, with homes and experiences from Diani to Lamu."
        path="/about"
      />

      <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">
        {settings?.business_name ?? 'About Nataka Holidays'}
      </h1>

      <p className="mt-4 text-lg text-charcoal-700">
        {settings?.about_blurb ??
          "We're a locally-run holiday rental business on the Kenyan Coast, managing villas, apartments and beach houses from Diani and the South Coast up through Watamu, Malindi and the Lamu archipelago."}
      </p>

      <div className="mt-6 flex flex-col gap-4 text-charcoal-700">
        <p>
          Nataka Holidays started with a simple idea: holiday rentals on this coast should
          feel personal, not like booking a room from a faceless platform. Every property we list
          is one we've walked through ourselves — we know the water pressure, the walk to the
          beach, and which room catches the evening breeze.
        </p>
        <p>
          Beyond the stay itself, we help guests get the most out of the whole Kenyan
          Coast — from arranging airport transfers to pointing you toward the right dhow trip,
          snorkeling spot, or quiet stretch of sand depending on what you're after.
        </p>
      </div>

      <SectionHeading eyebrow="Why Nataka" title="What guests can expect" />
      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
        {WHY_CHOOSE_US.map((item) => {
          const Icon = WHY_CHOOSE_US_ICONS[item.icon]
          return (
            <div key={item.title} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-900/10">
                <Icon className="h-5 w-5 text-teal-800" />
              </div>
              <div>
                <h3 className="font-display text-base font-medium text-teal-900">{item.title}</h3>
                <p className="mt-1 text-sm text-charcoal-500">{item.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-12 flex flex-col items-start gap-3 rounded-card bg-sand-100 p-8">
        <h2 className="font-display text-xl font-medium text-teal-900">Ready to plan your stay?</h2>
        <Link
          to="/holiday-homes"
          className="rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
        >
          Browse holiday homes
        </Link>
      </div>
    </div>
  )
}

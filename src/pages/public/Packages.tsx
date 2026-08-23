import { Link } from 'react-router-dom'
import { MessageCircle, ArrowRight } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { buildWhatsAppLink } from '@/utils/whatsapp'

/**
 * A real page, not a placeholder — but "packages" here means a
 * human-assembled bundle (a villa + a couple of experiences, quoted over
 * WhatsApp), not a distinct bookable product with its own pricing/admin
 * management. There's no `packages` table or admin section behind this;
 * it's built entirely from the Holiday Homes and Experiences content
 * that already exists. If "Packages" should be admin-managed bundles
 * with their own pricing, gallery, and booking flow — a real, separate
 * feature closer in size to Properties or Experiences — that's a
 * deliberate scope decision to make explicitly, not something to infer
 * silently from a nav label.
 */
export default function Packages() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <SEO
        title="Packages"
        description="Custom stay and experience packages with Nataka Holidays, Diani Beach."
        path="/packages"
      />

      <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">Packages</h1>

      <p className="mt-4 text-lg text-charcoal-700">
        Tell us how many nights, how many guests, and what you're after — we'll put together a
        villa, transport, and a few experiences into one straightforward quote.
      </p>

      <div className="mt-6 flex flex-col gap-4 text-charcoal-700">
        <p>
          A package might be a villa for a week plus a Wasini Island dolphin trip and an airport
          transfer, or something entirely custom. Browse holiday homes and experiences below for
          ideas, then message us with what you'd like combined — we'll confirm availability and
          one total price.
        </p>
      </div>

      <a
        href={buildWhatsAppLink('Hello Nataka Holidays, I would like to enquire about a package.')}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 flex w-fit items-center gap-2 rounded-full bg-teal-900 px-6 py-3 text-sm font-medium text-sand-50 transition-transform hover:scale-105"
      >
        <MessageCircle className="h-4 w-4" />
        Ask about a package on WhatsApp
      </a>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/holiday-homes"
          className="flex items-center justify-between gap-3 rounded-card border border-sand-200 bg-sand-50 p-6 shadow-card transition-shadow hover:shadow-card-hover"
        >
          <div>
            <h2 className="font-display text-lg font-medium text-teal-900">Browse holiday homes</h2>
            <p className="mt-1 text-sm text-charcoal-500">Villas, apartments, cottages, beach houses.</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-teal-800" />
        </Link>
        <Link
          to="/experiences"
          className="flex items-center justify-between gap-3 rounded-card border border-sand-200 bg-sand-50 p-6 shadow-card transition-shadow hover:shadow-card-hover"
        >
          <div>
            <h2 className="font-display text-lg font-medium text-teal-900">Browse experiences</h2>
            <p className="mt-1 text-sm text-charcoal-500">Dolphin trips, snorkeling, transfers, and more.</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-teal-800" />
        </Link>
      </div>
    </div>
  )
}

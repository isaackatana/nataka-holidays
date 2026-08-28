import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Briefcase, Home, Compass, X, MessageCircle, Send } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { InputField } from '@/components/ui/InputField'
import { TextareaField } from '@/components/ui/TextareaField'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'
import { useTripCart } from '@/features/tripCart/TripCartContext'
import { tripRequestSchema, type TripRequestValues } from '@/features/tripCart/schemas'
import { buildTripRequestMessage } from '@/features/tripCart/buildTripRequestMessage'
import { submitContactMessage } from '@/services/contact.service'
import { buildWhatsAppLink } from '@/utils/whatsapp'
import { formatKES } from '@/utils/currency'

export default function Trip() {
  const { user, profile } = useAuth()
  const { properties, experiences, removeProperty, removeExperience, clear, totalCount } = useTripCart()
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TripRequestValues>({ resolver: zodResolver(tripRequestSchema) })

  // Prefill from the logged-in profile, same pattern as BookingEnquiryForm
  // — returning customers shouldn't have to retype what we already know.
  useEffect(() => {
    if (profile?.full_name) setValue('name', profile.full_name)
    if (user?.email) setValue('email', user.email)
    if (profile?.phone) setValue('phone', profile.phone)
  }, [profile, user, setValue])

  async function onSubmit(values: TripRequestValues) {
    setSubmitError(null)
    const message = buildTripRequestMessage({
      properties,
      experiences,
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      guests: values.guests,
      notes: values.message,
    })

    try {
      // Written to contact_messages so it shows up in Admin → Messages
      // even if staff don't see the WhatsApp message right away — the
      // same underlying inbox built for the Contact page, reused here
      // rather than a new table for what's still fundamentally "someone
      // sent us a message asking about availability and pricing."
      await submitContactMessage({
        name: values.name,
        email: values.email,
        phone: values.phone,
        subject: 'Trip request (multiple items)',
        message,
      })

      window.open(buildWhatsAppLink(message), '_blank', 'noopener,noreferrer')
      setSubmitted(true)
      clear()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong sending your request.')
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-24">
        <h1 className="font-display text-3xl font-medium text-teal-900">Request sent</h1>
        <p className="text-charcoal-700">
          We've got your trip request and opened WhatsApp with the same details — send that
          message too if it doesn't go through automatically, and we'll confirm availability and
          the total price.
        </p>
        <Link to="/holiday-homes" className="text-teal-800 hover:underline">
          Keep browsing holiday homes
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <SEO
        title="Your Trip"
        description="Review the stays and experiences you've selected, then send us one combined request."
        noindex
      />

      <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">Your trip</h1>
      <p className="mt-2 text-charcoal-500">
        Add stays and experiences as you browse, then send it all as one request — we'll confirm
        availability and get back to you with a total price.
      </p>

      {totalCount === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-card border border-sand-200 bg-sand-50 py-16 text-center">
          <Briefcase className="h-10 w-10 text-sand-300" />
          <p className="text-charcoal-500">Nothing added yet.</p>
          <div className="flex gap-3">
            <Link
              to="/holiday-homes"
              className="rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
            >
              Browse holiday homes
            </Link>
            <Link
              to="/experiences"
              className="rounded-full border border-teal-900 px-6 py-2.5 text-sm font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50"
            >
              Browse experiences
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-3">
            {properties.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-card border border-sand-200 bg-sand-50 p-4"
              >
                <div className="flex items-center gap-3">
                  <Home className="h-4 w-4 shrink-0 text-teal-700" />
                  <div>
                    <Link to={`/stays/${p.slug}`} className="font-medium text-charcoal-900 hover:underline">
                      {p.title}
                    </Link>
                    <p className="font-figures text-sm text-charcoal-500">
                      {formatKES(p.price_per_night)} / night
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeProperty(p.id)}
                  aria-label={`Remove ${p.title}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-charcoal-500 hover:bg-coral-500/10 hover:text-coral-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            {experiences.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-card border border-sand-200 bg-sand-50 p-4"
              >
                <div className="flex items-center gap-3">
                  <Compass className="h-4 w-4 shrink-0 text-teal-700" />
                  <div>
                    <Link
                      to={`/experiences/${e.slug}`}
                      className="font-medium text-charcoal-900 hover:underline"
                    >
                      {e.title}
                    </Link>
                    {e.price !== null && (
                      <p className="font-figures text-sm text-charcoal-500">{formatKES(e.price)}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeExperience(e.id)}
                  aria-label={`Remove ${e.title}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-charcoal-500 hover:bg-coral-500/10 hover:text-coral-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-10 flex flex-col gap-4" noValidate>
            <h2 className="font-display text-xl font-medium text-teal-900">Your details</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField label="Full name" error={errors.name?.message} {...register('name')} />
              <InputField
                label="Phone"
                type="tel"
                error={errors.phone?.message}
                {...register('phone')}
              />
            </div>
            <InputField
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <InputField
                label="Check-in (optional)"
                type="date"
                error={errors.checkIn?.message}
                {...register('checkIn')}
              />
              <InputField
                label="Check-out (optional)"
                type="date"
                error={errors.checkOut?.message}
                {...register('checkOut')}
              />
              <InputField
                label="Guests (optional)"
                type="number"
                min={1}
                error={errors.guests?.message}
                {...register('guests', { valueAsNumber: true })}
              />
            </div>

            <TextareaField
              label="Anything else we should know? (optional)"
              rows={3}
              error={errors.message?.message}
              {...register('message')}
            />

            {submitError && <p className="text-sm text-coral-500">{submitError}</p>}

            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" loading={isSubmitting} className="flex-1">
                <Send className="h-4 w-4" />
                Send trip request
              </Button>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-charcoal-500">
              <MessageCircle className="h-3.5 w-3.5" />
              This also opens WhatsApp with the same details, so you can follow up directly.
            </p>
          </form>
        </>
      )}
    </div>
  )
}

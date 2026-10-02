import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/features/auth/AuthContext'
import { useBookingBlocks, useCreateBookingEnquiry } from '@/features/bookings/queries'
import { bookingEnquirySchema, type BookingEnquiryValues } from '@/features/bookings/schemas'
import { calculateNights, rangesOverlap, todayISO } from '@/utils/dates'
import { formatKES } from '@/utils/currency'
import { AvailabilityCalendar } from '@/components/property/AvailabilityCalendar'
import { InputField } from '@/components/ui/InputField'
import { Button } from '@/components/ui/Button'
import type { Property } from '@/types/domain'
import { CheckCircle2 } from 'lucide-react'

export function BookingEnquiryForm({ property }: { property: Property }) {
  const { user, profile } = useAuth()
  const { data: blocks } = useBookingBlocks(property.id)
  const createBooking = useCreateBookingEnquiry()
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BookingEnquiryValues>({
    resolver: zodResolver(bookingEnquirySchema),
    defaultValues: {
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      checkIn: '',
      checkOut: '',
      guests: 2,
      message: '',
    },
  })

  // Prefill from the logged-in profile so returning customers don't
  // retype their details on every enquiry.
  useEffect(() => {
    if (profile?.full_name) setValue('guestName', profile.full_name)
    if (user?.email) setValue('guestEmail', user.email)
    if (profile?.phone) setValue('guestPhone', profile.phone)
  }, [profile, user, setValue])

  const checkIn = watch('checkIn')
  const checkOut = watch('checkOut')
  const guests = watch('guests')

  const nights = checkIn && checkOut ? calculateNights(checkIn, checkOut) : 0
  const estimatedTotal =
    nights > 0 ? nights * property.price_per_night + Number(property.cleaning_fee) : 0

  const hasConflict =
    !!checkIn &&
    !!checkOut &&
    checkOut > checkIn &&
    (blocks ?? []).some((b) => rangesOverlap(checkIn, checkOut, b.start_date, b.end_date))

  async function onSubmit(values: BookingEnquiryValues) {
    if (hasConflict) return
    await createBooking.mutateAsync({
      propertyId: property.id,
      customerId: user?.id ?? null,
      guestName: values.guestName,
      guestEmail: values.guestEmail,
      guestPhone: values.guestPhone,
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      guests: values.guests,
      message: values.message,
      estimatedTotal,
    })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card bg-teal-950 p-8 text-center text-sand-50">
        <CheckCircle2 className="h-10 w-10 text-gold-400" />
        <h3 className="font-display text-xl font-medium">Enquiry sent</h3>
        <p className="text-sm text-sand-300">
          We'll get back to you shortly to confirm availability and next steps.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-card border border-sand-200 bg-sand-50 p-6 shadow-card"
      noValidate
    >
      <div className="flex items-baseline gap-1">
        <span className="font-figures text-2xl font-medium text-teal-900">
          {formatKES(property.price_per_night)}
        </span>
        <span className="text-sm text-charcoal-500">/ night</span>
      </div>

      <AvailabilityCalendar
        blocks={blocks ?? []}
        value={{ checkIn: checkIn ?? '', checkOut: checkOut ?? '' }}
        onChange={(next) => {
          // Only validate once both dates exist, so choosing a check-in
          // doesn't flash a "select a check-out date" error.
          setValue('checkIn', next.checkIn, { shouldDirty: true, shouldValidate: !!next.checkOut })
          setValue('checkOut', next.checkOut, { shouldDirty: true, shouldValidate: !!next.checkOut })
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        <InputField
          label="Check-in"
          type="date"
          min={todayISO()}
          error={errors.checkIn?.message}
          {...register('checkIn')}
        />
        <InputField
          label="Check-out"
          type="date"
          min={checkIn || todayISO()}
          error={errors.checkOut?.message}
          {...register('checkOut')}
        />
      </div>

      <InputField
        label="Guests"
        type="number"
        min={1}
        max={property.max_guests}
        error={errors.guests?.message}
        {...register('guests', { valueAsNumber: true })}
      />
      {guests > property.max_guests && (
        <p className="text-xs text-coral-500">This home sleeps up to {property.max_guests} guests.</p>
      )}

      {hasConflict && (
        <p className="rounded-lg bg-coral-500/10 px-3 py-2 text-xs text-coral-500">
          Those dates overlap with an existing booking. Please choose a different range.
        </p>
      )}

      {nights > 0 && !hasConflict && (
        <div className="flex flex-col gap-1 rounded-lg bg-sand-100 px-3 py-2 text-sm text-charcoal-700">
          <div className="flex justify-between">
            <span className="font-figures">
              {formatKES(property.price_per_night)} × {nights} night{nights === 1 ? '' : 's'}
            </span>
            <span className="font-figures">{formatKES(property.price_per_night * nights)}</span>
          </div>
          {property.cleaning_fee > 0 && (
            <div className="flex justify-between">
              <span>Cleaning fee</span>
              <span className="font-figures">{formatKES(property.cleaning_fee)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-sand-300 pt-1 font-medium">
            <span>Estimated total</span>
            <span className="font-figures">{formatKES(estimatedTotal)}</span>
          </div>
        </div>
      )}

      <InputField label="Full name" error={errors.guestName?.message} {...register('guestName')} />
      <InputField label="Email" type="email" error={errors.guestEmail?.message} {...register('guestEmail')} />
      <InputField label="Phone" type="tel" error={errors.guestPhone?.message} {...register('guestPhone')} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="enquiry-message" className="text-sm font-medium text-charcoal-700">Message (optional)</label>
        <textarea
          id="enquiry-message"
          rows={3}
          {...register('message')}
          className="rounded-lg border border-sand-300 bg-sand-50 px-4 py-2.5 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-500 focus:border-teal-700"
          placeholder="Anything we should know?"
        />
      </div>

      <Button type="submit" loading={isSubmitting} disabled={hasConflict} className="mt-1 w-full">
        Send booking enquiry
      </Button>
      <p className="text-center text-xs text-charcoal-600">
        This sends an enquiry — payment isn't collected online. We'll confirm availability directly.
      </p>
    </form>
  )
}

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useSubmitExperienceRequest } from '@/features/experienceRequests/queries'
import {
  experienceRequestSchema,
  type ExperienceRequestValues,
} from '@/features/experienceRequests/schemas'
import { estimateExperienceTotal, priceBasisLabel } from '@/data/experienceOptions'
import { InputField } from '@/components/ui/InputField'
import { TextareaField } from '@/components/ui/TextareaField'
import { Button } from '@/components/ui/Button'
import { todayISO } from '@/utils/dates'
import { formatKES } from '@/utils/currency'
import type { Experience } from '@/types/domain'

/** The database's own wording for refusals we want guests to see (full group, date passed...). */
function friendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null
  if (e?.code === '23514' && e.message && !e.message.includes('violates check constraint')) return e.message
  return "We couldn't send your request. Please try again, or message us on WhatsApp."
}

export function ExperienceRequestForm({ experience }: { experience: Experience }) {
  const { user, profile } = useAuth()
  const submit = useSubmitExperienceRequest()
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExperienceRequestValues>({
    resolver: zodResolver(experienceRequestSchema),
    defaultValues: { guestName: '', guestEmail: '', guestPhone: '', preferredDate: '', people: 2, message: '' },
  })

  // Prefill for signed-in guests so they don't retype their details.
  useEffect(() => {
    if (profile?.full_name) setValue('guestName', profile.full_name)
    if (user?.email) setValue('guestEmail', user.email)
    if (profile?.phone) setValue('guestPhone', profile.phone)
  }, [profile, user, setValue])

  const people = Number(watch('people'))
  const total = estimateExperienceTotal(experience.price, experience.price_type, people)
  const maxGroup = experience.max_group_size ?? null

  async function onSubmit(values: ExperienceRequestValues) {
    setFormError(null)
    if (maxGroup !== null && values.people > maxGroup) {
      setFormError(`This experience takes at most ${maxGroup} people.`)
      return
    }
    try {
      await submit.mutateAsync({
        id: crypto.randomUUID(),
        experienceId: experience.id,
        experienceTitle: experience.title,
        guestName: values.guestName,
        guestEmail: values.guestEmail,
        guestPhone: values.guestPhone,
        preferredDate: values.preferredDate,
        people: values.people,
        message: values.message,
      })
      setSubmitted(true)
    } catch (err) {
      setFormError(friendlyError(err))
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card border border-sand-200 bg-sand-100 p-6">
        <CheckCircle2 className="h-8 w-8 text-palm-green" aria-hidden="true" />
        <h3 className="font-display text-xl font-medium text-teal-900">Request sent</h3>
        <p className="text-sm text-charcoal-700">
          Thank you. We've emailed you a copy and will confirm your date and the final price by WhatsApp or
          email. Nothing is charged until we confirm.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4 rounded-card border border-sand-200 bg-sand-50 p-6"
      aria-label={`Request ${experience.title}`}
    >
      <div>
        <h2 className="font-display text-xl font-medium text-teal-900">Request this experience</h2>
        <p className="mt-1 text-sm text-charcoal-500">
          Tell us when and how many. We'll confirm availability and the final price. No payment now.
          {experience.deposit_percent
            ? ` Once confirmed, you can secure your date with a ${experience.deposit_percent}% deposit by M-Pesa.`
            : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InputField
          label="Preferred date"
          type="date"
          min={todayISO()}
          error={errors.preferredDate?.message}
          {...register('preferredDate')}
        />
        <InputField
          label="Number of people"
          type="number"
          min={1}
          max={maxGroup ?? 100}
          inputMode="numeric"
          error={errors.people?.message}
          {...register('people', { valueAsNumber: true })}
        />
      </div>
      {maxGroup !== null && <p className="-mt-2 text-xs text-charcoal-500">Up to {maxGroup} people per booking.</p>}

      <InputField label="Your name" autoComplete="name" error={errors.guestName?.message} {...register('guestName')} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InputField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.guestEmail?.message}
          {...register('guestEmail')}
        />
        <InputField
          label="Phone / WhatsApp"
          type="tel"
          autoComplete="tel"
          error={errors.guestPhone?.message}
          {...register('guestPhone')}
        />
      </div>
      <TextareaField
        label="Anything we should know? (optional)"
        rows={3}
        maxLength={1000}
        error={errors.message?.message}
        {...register('message')}
      />

      {experience.price !== null && (
        <p className="rounded-lg bg-sand-100 px-4 py-3 text-sm text-charcoal-700" aria-live="polite">
          {total !== null ? (
            <>
              Estimated total <strong className="font-figures text-teal-900">{formatKES(total)}</strong>
              {experience.price_type === 'per_person' && Number.isFinite(people) && people > 0 && (
                <span className="text-charcoal-500">
                  {' '}
                  ({formatKES(experience.price)} {priceBasisLabel(experience.price_type)} × {people})
                </span>
              )}
              . We'll confirm the final price.
            </>
          ) : (
            <>From {formatKES(experience.price)}. We'll confirm the total for your group.</>
          )}
        </p>
      )}

      {formError && <p className="text-sm text-coral-500">{formError}</p>}

      <Button type="submit" loading={isSubmitting}>
        Send request
      </Button>
    </form>
  )
}

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { InputField } from '@/components/ui/InputField'
import { TextareaField } from '@/components/ui/TextareaField'
import { Button } from '@/components/ui/Button'
import { submitContactMessage } from '@/services/contact.service'
import { contactFormSchema, type ContactFormValues } from '@/features/contact/schemas'
import { useBusinessSettings } from '@/features/settings/queries'
import { buildWhatsAppLink } from '@/utils/whatsapp'

export default function Contact() {
  const { data: settings } = useBusinessSettings()
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormValues>({ resolver: zodResolver(contactFormSchema) })

  const submitMutation = useMutation({
    mutationFn: submitContactMessage,
    onSuccess: () => setSubmitted(true),
  })

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 py-12 lg:grid-cols-[1fr_1.2fr]">
      <SEO
        title="Contact Us"
        description="Get in touch with Nataka Holidays about a stay, a booking enquiry, or planning a trip anywhere on the Kenyan Coast."
        path="/contact"
      />

      <div>
        <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">Get in touch</h1>
        <p className="mt-3 text-charcoal-600">
          Questions about a property, a booking, or planning your trip to the coast — we're happy to
          help.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          {settings?.contact_phone && (
            <a
              href={`tel:${settings.contact_phone.replace(/\s+/g, '')}`}
              className="flex items-center gap-3 text-sm text-charcoal-700 hover:text-teal-800"
            >
              <Phone className="h-4 w-4" />
              {settings.contact_phone}
            </a>
          )}
          {settings?.contact_email && (
            <a
              href={`mailto:${settings.contact_email}`}
              className="flex items-center gap-3 text-sm text-charcoal-700 hover:text-teal-800"
            >
              <Mail className="h-4 w-4" />
              {settings.contact_email}
            </a>
          )}
          {settings?.address && (
            <span className="flex items-center gap-3 text-sm text-charcoal-700">
              <MapPin className="h-4 w-4" />
              {settings.address}
            </span>
          )}
          <a
            href={buildWhatsAppLink('Hello Nataka Holidays, I have a question.')}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex w-fit items-center gap-2 rounded-full bg-teal-900 px-5 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
          >
            <MessageCircle className="h-4 w-4" />
            Chat on WhatsApp
          </a>
        </div>
      </div>

      <div className="rounded-card border border-sand-200 bg-sand-50 p-6 md:p-8">
        {submitted ? (
          <div className="flex flex-col items-start gap-2 py-8">
            <h2 className="font-display text-xl font-medium text-teal-900">Message sent</h2>
            <p className="text-charcoal-600">
              Thanks for reaching out — we'll get back to you as soon as we can.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit((values) => submitMutation.mutate(values))}
            className="flex flex-col gap-4"
            noValidate
          >
            <InputField label="Name" error={errors.name?.message} {...register('name')} />
            <InputField label="Email" type="email" error={errors.email?.message} {...register('email')} />
            <InputField label="Phone (optional)" error={errors.phone?.message} {...register('phone')} />
            <InputField label="Subject (optional)" error={errors.subject?.message} {...register('subject')} />
            <TextareaField
              label="Message"
              rows={5}
              error={errors.message?.message}
              {...register('message')}
            />

            {submitMutation.isError && (
              <p className="text-sm text-coral-500">Something went wrong sending your message. Please try again.</p>
            )}

            <Button type="submit" loading={submitMutation.isPending} className="mt-2">
              Send message
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

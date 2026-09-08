import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { InputField } from '@/components/ui/InputField'
import { TextareaField } from '@/components/ui/TextareaField'
import { Button } from '@/components/ui/Button'
import { useBusinessSettings, useUpdateBusinessSettings } from '@/features/settings/queries'
import { businessSettingsSchema, type BusinessSettingsFormValues } from '@/features/settings/schemas'

export default function AdminSettings() {
  const { data: settings, isLoading } = useBusinessSettings()
  const updateSettings = useUpdateBusinessSettings()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BusinessSettingsFormValues>({
    resolver: zodResolver(businessSettingsSchema),
  })

  useEffect(() => {
    if (settings) {
      reset({
        business_name: settings.business_name,
        contact_phone: settings.contact_phone ?? '',
        contact_email: settings.contact_email ?? '',
        address: settings.address ?? '',
        about_blurb: settings.about_blurb ?? '',
        instagram_url: settings.instagram_url ?? '',
        facebook_url: settings.facebook_url ?? '',
        hero_video_url: settings.hero_video_url ?? '',
        hero_image_url: settings.hero_image_url ?? '',
      })
    }
  }, [settings, reset])

  async function onSubmit(values: BusinessSettingsFormValues) {
    await updateSettings.mutateAsync({
      business_name: values.business_name,
      contact_phone: values.contact_phone || null,
      contact_email: values.contact_email || null,
      address: values.address || null,
      about_blurb: values.about_blurb || null,
      instagram_url: values.instagram_url || null,
      facebook_url: values.facebook_url || null,
      hero_video_url: values.hero_video_url || null,
      hero_image_url: values.hero_image_url || null,
    })
  }

  if (isLoading) {
    return <div className="px-4 py-6 sm:px-8 sm:py-8 text-charcoal-500">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-2xl font-medium text-teal-900">Settings</h1>
      <p className="mt-1 text-sm text-charcoal-500">
        Business info shown across the public site — contact details, address, and about text.
      </p>

      <div className="mt-4 rounded-lg bg-gold-500/10 p-3 text-xs text-charcoal-600">
        The WhatsApp number used for chat links is set separately via the{' '}
        <code className="rounded bg-sand-200 px-1 py-0.5 font-mono">VITE_WHATSAPP_NUMBER</code>{' '}
        environment variable, not here — it's compiled into the site at build time, so changing it
        requires a redeploy.
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-5" noValidate>
        <InputField
          label="Business name"
          error={errors.business_name?.message}
          {...register('business_name')}
        />
        <InputField
          label="Contact phone"
          placeholder="+254 700 000 000"
          error={errors.contact_phone?.message}
          {...register('contact_phone')}
        />
        <InputField
          label="Contact email"
          type="email"
          error={errors.contact_email?.message}
          {...register('contact_email')}
        />
        <InputField label="Address" error={errors.address?.message} {...register('address')} />
        <TextareaField
          label="About blurb"
          rows={4}
          error={errors.about_blurb?.message}
          {...register('about_blurb')}
        />
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Instagram URL"
            error={errors.instagram_url?.message}
            {...register('instagram_url')}
          />
          <InputField
            label="Facebook URL"
            error={errors.facebook_url?.message}
            {...register('facebook_url')}
          />
        </div>

        <div className="border-t border-sand-200 pt-5">
          <h2 className="font-display text-lg font-medium text-teal-900">Homepage hero</h2>
          <p className="mt-1 text-xs text-charcoal-500">
            Shown behind the headline and search bar at the top of the homepage. If both are set,
            the video plays with the image as its poster (shown while the video loads). If
            neither is set, the homepage falls back to its default background.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <InputField
              label="Hero background video URL"
              placeholder="Direct video file link (.mp4/.webm)"
              error={errors.hero_video_url?.message}
              {...register('hero_video_url')}
            />
            <p className="-mt-3 text-xs text-charcoal-500">
              Must be a direct video file link, not a YouTube/Vimeo page — this plays silently and
              on a loop as a background, which those platforms' embeds aren't built for. Keep the
              file short and lightweight; it downloads in full for every visitor.
            </p>
            <InputField
              label="Hero background image URL"
              placeholder="Shown as a fallback / while the video loads"
              error={errors.hero_image_url?.message}
              {...register('hero_image_url')}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-sand-200 pt-5">
          {updateSettings.isSuccess && !isDirty && (
            <span className="flex items-center gap-1.5 text-sm text-teal-800">
              <Check className="h-4 w-4" />
              Saved
            </span>
          )}
          <Button type="submit" loading={isSubmitting}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  )
}

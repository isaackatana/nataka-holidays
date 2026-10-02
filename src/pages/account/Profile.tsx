import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { InputField } from '@/components/ui/InputField'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'
import { updateProfile } from '@/services/profiles.service'

const profileSchema = z.object({
  full_name: z.string().min(2, 'Enter your full name'),
  phone: z.string().optional(),
})
type ProfileFormValues = z.infer<typeof profileSchema>

export default function Profile() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema) })

  useEffect(() => {
    if (profile) {
      reset({ full_name: profile.full_name ?? '', phone: profile.phone ?? '' })
    }
  }, [profile, reset])

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateProfile(user!.id, { full_name: values.full_name, phone: values.phone || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      setSaved(true)
    },
  })

  async function onSubmit(values: ProfileFormValues) {
    setSaved(false)
    await updateMutation.mutateAsync(values)
  }

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-12">
      <SEO title="Your Profile" description="Manage your Nataka Holidays account." noindex />

      <h1 className="font-display text-3xl font-medium text-teal-900">Your profile</h1>
      <p className="mt-2 text-charcoal-500">Update your name and phone number.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <span id="profile-email-label" className="text-sm font-medium text-charcoal-700">Email</span>
          <p aria-labelledby="profile-email-label" className="rounded-lg border border-sand-200 bg-sand-100 px-4 py-2.5 text-sm text-charcoal-500">
            {user?.email}
          </p>
          <p className="text-xs text-charcoal-600">
            Email can't be changed here — contact us if you need it updated.
          </p>
        </div>

        <InputField label="Full name" error={errors.full_name?.message} {...register('full_name')} />
        <InputField label="Phone" error={errors.phone?.message} {...register('phone')} />

        {updateMutation.isError && (
          <p className="text-sm text-coral-500">Something went wrong saving your profile.</p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save changes
          </Button>
          {saved && !isDirty && (
            <span className="flex items-center gap-1.5 text-sm text-teal-800">
              <Check className="h-4 w-4" />
              Saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

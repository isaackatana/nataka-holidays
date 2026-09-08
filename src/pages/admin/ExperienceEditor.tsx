import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { InputField } from '@/components/ui/InputField'
import { TextareaField } from '@/components/ui/TextareaField'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import {
  useAdminExperience,
  useCreateExperience,
  useUpdateExperience,
} from '@/features/admin/experiences/queries'
import { experienceSchema, type ExperienceFormValues } from '@/features/admin/experiences/schemas'
import { slugify } from '@/utils/slugify'
import { ExperienceImageUploader } from '@/components/admin/ExperienceImageUploader'

export default function ExperienceEditor() {
  const { id } = useParams()
  const isEditing = !!id
  const navigate = useNavigate()

  const { data: existing, isLoading: loadingExisting } = useAdminExperience(id)
  const createExperience = useCreateExperience()
  const updateExperience = useUpdateExperience(id ?? '')
  const [slugTouched, setSlugTouched] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExperienceFormValues>({
    resolver: zodResolver(experienceSchema),
    defaultValues: { is_published: true },
  })

  const titleValue = watch('title')

  // Auto-generate the slug from the title, same pattern as the property
  // editor — until the admin edits the slug field directly themselves
  // (tracked explicitly via slugTouched, set on the slug input's onChange).
  useEffect(() => {
    if (!isEditing && !slugTouched && titleValue) setValue('slug', slugify(titleValue))
  }, [titleValue, slugTouched, isEditing, setValue])

  useEffect(() => {
    if (existing) {
      reset({
        title: existing.title,
        slug: existing.slug,
        description: existing.description,
        location: existing.location ?? '',
        price: existing.price ?? undefined,
        duration: existing.duration ?? '',
        video_url: existing.video_url ?? '',
        is_published: existing.is_published,
      })
    }
  }, [existing, reset])

  async function onSubmit(values: ExperienceFormValues) {
    const input = {
      title: values.title,
      slug: values.slug,
      description: values.description,
      location: values.location || null,
      price: values.price ?? null,
      duration: values.duration || null,
      video_url: values.video_url || null,
      is_published: values.is_published,
    }

    if (isEditing) {
      await updateExperience.mutateAsync(input)
    } else {
      const created = await createExperience.mutateAsync(input)
      navigate(`/admin/experiences/${created.id}/edit`, { replace: true })
      return
    }
    navigate('/admin/experiences')
  }

  if (isEditing && loadingExisting) {
    return <div className="px-4 py-6 sm:px-8 sm:py-8 text-charcoal-500">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-8">
      <Link to="/admin/experiences" className="flex items-center gap-1.5 text-sm text-charcoal-500 hover:text-teal-800">
        <ArrowLeft className="h-4 w-4" />
        Back to experiences
      </Link>

      <h1 className="mt-3 font-display text-2xl font-medium text-teal-900">
        {isEditing ? 'Edit experience' : 'New experience'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-5" noValidate>
        <InputField label="Title" error={errors.title?.message} {...register('title')} />
        <InputField
          label="Slug"
          error={errors.slug?.message}
          {...register('slug', { onChange: () => setSlugTouched(true) })}
        />
        <TextareaField label="Description" rows={4} error={errors.description?.message} {...register('description')} />
        <InputField label="Location" error={errors.location?.message} {...register('location')} />
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Price (KES)"
            type="number"
            step="1"
            error={errors.price?.message}
            {...register('price', { valueAsNumber: true })}
          />
          <InputField
            label="Duration"
            placeholder="Full day, 3 hours..."
            error={errors.duration?.message}
            {...register('duration')}
          />
        </div>

        <InputField
          label="Video URL (optional)"
          placeholder="YouTube, Vimeo, or a direct video file link"
          error={errors.video_url?.message}
          {...register('video_url')}
        />

        <Toggle
          label="Published"
          description="Visible on the public Experiences page"
          checked={watch('is_published')}
          onChange={(checked) => setValue('is_published', checked)}
        />

        <div className="flex justify-end gap-3 border-t border-sand-200 pt-5">
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Save changes' : 'Create experience'}
          </Button>
        </div>
      </form>

      <div className="mt-8">
        {isEditing && existing ? (
          <ExperienceImageUploader
            experienceId={existing.id}
            images={existing.experience_images ?? []}
          />
        ) : (
          <div className="rounded-card border border-dashed border-sand-300 bg-sand-100 p-6 text-center text-sm text-charcoal-500">
            Save this experience first, then come back to add photos.
          </div>
        )}
      </div>
    </div>
  )
}

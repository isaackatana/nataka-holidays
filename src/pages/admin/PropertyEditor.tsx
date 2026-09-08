import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus } from 'lucide-react'
import { propertySchema, type PropertyFormValues } from '@/features/admin/properties/schemas'
import {
  useAdminProperty,
  useCreateProperty,
  useUpdateProperty,
} from '@/features/admin/properties/queries'
import { useAmenities } from '@/features/properties/queries'
import { ImageUploader } from '@/components/admin/ImageUploader'
import { slugify } from '@/utils/slugify'
import { InputField } from '@/components/ui/InputField'
import { TextareaField } from '@/components/ui/TextareaField'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'

const PROPERTY_TYPES: { value: PropertyFormValues['propertyType']; label: string }[] = [
  { value: 'villa', label: 'Villa' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'cottage', label: 'Cottage' },
  { value: 'beach_house', label: 'Beach House' },
  { value: 'other', label: 'Other' },
]

const DEFAULT_VALUES: PropertyFormValues = {
  title: '',
  slug: '',
  description: '',
  location: '',
  propertyType: 'villa',
  pricePerNight: 0,
  cleaningFee: 0,
  maxGuests: 2,
  bedrooms: 1,
  bathrooms: 1,
  houseRules: '',
  checkInTime: '14:00',
  checkOutTime: '10:00',
  videoUrl: '',
  latitude: undefined,
  longitude: undefined,
  isFeatured: false,
  isPublished: false,
  amenityIds: [],
}

export default function PropertyEditor() {
  const { id } = useParams()
  const isEditing = !!id
  const navigate = useNavigate()

  const { data: existingProperty, isLoading: propertyLoading } = useAdminProperty(id)
  const { data: amenities } = useAmenities()
  const createProperty = useCreateProperty()
  const updateProperty = useUpdateProperty()

  const [slugTouched, setSlugTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: DEFAULT_VALUES,
  })

  // Populate the form once the existing property has loaded (edit mode).
  // RHF's defaultValues only apply on first render, so an async fetch
  // needs an explicit reset() once data arrives.
  useEffect(() => {
    if (!existingProperty) return
    reset({
      title: existingProperty.title,
      slug: existingProperty.slug,
      description: existingProperty.description,
      location: existingProperty.location,
      propertyType: existingProperty.property_type,
      pricePerNight: existingProperty.price_per_night,
      cleaningFee: existingProperty.cleaning_fee,
      maxGuests: existingProperty.max_guests,
      bedrooms: existingProperty.bedrooms,
      bathrooms: existingProperty.bathrooms,
      houseRules: existingProperty.house_rules ?? '',
      checkInTime: existingProperty.check_in_time,
      checkOutTime: existingProperty.check_out_time,
      videoUrl: existingProperty.video_url ?? '',
      latitude: existingProperty.latitude ?? undefined,
      longitude: existingProperty.longitude ?? undefined,
      isFeatured: existingProperty.is_featured,
      isPublished: existingProperty.is_published,
      amenityIds: existingProperty.amenityIds,
    })
    setSlugTouched(true) // don't clobber an existing slug on title edits
  }, [existingProperty, reset])

  const title = watch('title')
  const isFeatured = watch('isFeatured')
  const isPublished = watch('isPublished')
  const amenityIds = watch('amenityIds')

  // Auto-generate the slug from the title until the admin edits the slug
  // field directly — after that, their edit wins.
  useEffect(() => {
    if (!slugTouched && title) setValue('slug', slugify(title))
  }, [title, slugTouched, setValue])

  function toggleAmenity(id: string) {
    setValue('amenityIds', amenityIds.includes(id) ? amenityIds.filter((a) => a !== id) : [...amenityIds, id])
  }

  async function onSubmit(values: PropertyFormValues) {
    setFormError(null)
    try {
      if (isEditing) {
        await updateProperty.mutateAsync({ id: id!, input: values })
      } else {
        const created = await createProperty.mutateAsync(values)
        // Move straight into edit mode for the new property so the image
        // uploader (Step 15) has a real property id to attach images to.
        navigate(`/admin/properties/${created.id}/edit`, { replace: true })
        return
      }
      navigate('/admin/properties')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong saving this property.')
    }
  }

  if (isEditing && propertyLoading) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="h-96 animate-pulse rounded-card bg-sand-200" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-2xl font-medium text-teal-900">
        {isEditing ? 'Edit property' : 'New property'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]" noValidate>
        {/* ---------------- MAIN COLUMN ---------------- */}
        <div className="flex flex-col gap-6">
          <div className="rounded-card border border-sand-200 bg-sand-50 p-6">
            <h2 className="font-display text-lg font-medium text-teal-900">Basics</h2>
            <div className="mt-4 flex flex-col gap-4">
              <InputField label="Title" error={errors.title?.message} {...register('title')} />
              <InputField
                label="Slug"
                error={errors.slug?.message}
                {...register('slug', { onChange: () => setSlugTouched(true) })}
              />
              <TextareaField
                label="Description"
                rows={5}
                error={errors.description?.message}
                {...register('description')}
              />
              <InputField label="Location" placeholder="Diani Beach, Kwale" error={errors.location?.message} {...register('location')} />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-charcoal-700">Property type</label>
                <select
                  {...register('propertyType')}
                  className="rounded-lg border border-sand-300 bg-sand-50 px-4 py-2.5 text-sm text-charcoal-900 outline-none focus:border-teal-700"
                >
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-sand-200 bg-sand-50 p-6">
            <h2 className="font-display text-lg font-medium text-teal-900">Pricing &amp; capacity</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <InputField
                label="Price per night (KES)"
                type="number"
                min={0}
                error={errors.pricePerNight?.message}
                {...register('pricePerNight', { valueAsNumber: true })}
              />
              <InputField
                label="Cleaning fee (KES)"
                type="number"
                min={0}
                error={errors.cleaningFee?.message}
                {...register('cleaningFee', { valueAsNumber: true })}
              />
              <InputField
                label="Max guests"
                type="number"
                min={1}
                error={errors.maxGuests?.message}
                {...register('maxGuests', { valueAsNumber: true })}
              />
              <InputField
                label="Bedrooms"
                type="number"
                min={0}
                error={errors.bedrooms?.message}
                {...register('bedrooms', { valueAsNumber: true })}
              />
              <InputField
                label="Bathrooms"
                type="number"
                min={0}
                error={errors.bathrooms?.message}
                {...register('bathrooms', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="rounded-card border border-sand-200 bg-sand-50 p-6">
            <h2 className="font-display text-lg font-medium text-teal-900">Amenities</h2>
            {amenities && amenities.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {amenities.map((amenity) => (
                  <label key={amenity.id} className="flex items-center gap-2 text-sm text-charcoal-700">
                    <input
                      type="checkbox"
                      checked={amenityIds.includes(amenity.id)}
                      onChange={() => toggleAmenity(amenity.id)}
                      className="h-4 w-4 rounded border-sand-300 text-teal-700 focus:ring-teal-700"
                    />
                    {amenity.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-charcoal-500">
                No amenities defined yet. Add some from the Settings page.
              </p>
            )}
          </div>

          <div className="rounded-card border border-sand-200 bg-sand-50 p-6">
            <h2 className="font-display text-lg font-medium text-teal-900">Stay details</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <InputField
                label="Check-in time"
                type="time"
                error={errors.checkInTime?.message}
                {...register('checkInTime')}
              />
              <InputField
                label="Check-out time"
                type="time"
                error={errors.checkOutTime?.message}
                {...register('checkOutTime')}
              />
            </div>
            <div className="mt-4">
              <TextareaField
                label="House rules"
                rows={3}
                placeholder="No parties. Check-in after 2pm. No smoking indoors."
                error={errors.houseRules?.message}
                {...register('houseRules')}
              />
            </div>
            <div className="mt-4">
              <InputField
                label="Video URL (optional)"
                placeholder="YouTube, Vimeo, or a direct video file link"
                error={errors.videoUrl?.message}
                {...register('videoUrl')}
              />
            </div>
          </div>

          <div className="rounded-card border border-sand-200 bg-sand-50 p-6">
            <h2 className="font-display text-lg font-medium text-teal-900">Location on map</h2>
            <p className="mt-1 text-xs text-charcoal-500">
              Optional — used for the map on the property's public page. Find coordinates via Google Maps
              (right-click a spot → the numbers shown are lat, lng).
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <InputField
                label="Latitude"
                type="number"
                step="any"
                error={errors.latitude?.message}
                {...register('latitude', { valueAsNumber: true, setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
              />
              <InputField
                label="Longitude"
                type="number"
                step="any"
                error={errors.longitude?.message}
                {...register('longitude', { valueAsNumber: true, setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
              />
            </div>
          </div>

          {isEditing && existingProperty ? (
            <ImageUploader propertyId={existingProperty.id} images={existingProperty.property_images ?? []} />
          ) : (
            <div className="rounded-card border border-dashed border-sand-300 bg-sand-100 p-6 text-center">
              <ImagePlus className="mx-auto h-6 w-6 text-charcoal-400" />
              <p className="mt-2 text-sm text-charcoal-500">
                Save this property first, then come back to add photos.
              </p>
            </div>
          )}
        </div>

        {/* ---------------- SIDEBAR ---------------- */}
        <div className="flex flex-col gap-4">
          <div className="sticky top-24 flex flex-col gap-4 rounded-card border border-sand-200 bg-sand-50 p-6">
            <Toggle
              checked={isPublished}
              onChange={(v) => setValue('isPublished', v)}
              label="Published"
              description="Visible to the public"
            />
            <Toggle
              checked={isFeatured}
              onChange={(v) => setValue('isFeatured', v)}
              label="Featured"
              description="Shown on the homepage"
            />

            {formError && <p className="text-sm text-coral-500">{formError}</p>}

            <Button type="submit" loading={isSubmitting} className="w-full">
              {isEditing ? 'Save changes' : 'Create property'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

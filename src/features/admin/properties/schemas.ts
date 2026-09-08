import { z } from 'zod'

export const propertySchema = z.object({
  title: z.string().min(3, 'Title is required'),
  slug: z
    .string()
    .min(3, 'Slug is required')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only'),
  description: z.string().min(20, 'Add a fuller description (at least 20 characters)'),
  location: z.string().min(2, 'Location is required'),
  propertyType: z.enum(['villa', 'apartment', 'cottage', 'beach_house', 'other']),
  pricePerNight: z.number().min(0, 'Must be 0 or more'),
  cleaningFee: z.number().min(0, 'Must be 0 or more'),
  maxGuests: z.number().min(1, 'At least 1 guest'),
  bedrooms: z.number().min(0, 'Must be 0 or more'),
  bathrooms: z.number().min(0, 'Must be 0 or more'),
  houseRules: z.string().optional(),
  checkInTime: z.string().min(1, 'Required'),
  checkOutTime: z.string().min(1, 'Required'),
  videoUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  amenityIds: z.array(z.string()),
})

export type PropertyFormValues = z.infer<typeof propertySchema>

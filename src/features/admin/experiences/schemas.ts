import { z } from 'zod'

export const experienceSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  slug: z
    .string()
    .min(2, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  description: z.string().min(10, 'Add a short description'),
  location: z.string().optional(),
  price: z.number().min(0, 'Price cannot be negative').optional(),
  duration: z.string().optional(),
  video_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  price_type: z.enum(['', 'per_person', 'per_group']).optional(),
  category: z.enum(['', 'water', 'safari', 'culture', 'food', 'adventure', 'wellness', 'other']).optional(),
  included: z.string().max(2000, 'Keep this under 2,000 characters').optional(),
  meeting_point: z.string().max(500, 'Keep this under 500 characters').optional(),
  min_age: z.number().int().min(0, 'Cannot be negative').max(99, 'Too high').optional(),
  what_to_bring: z.string().max(2000, 'Keep this under 2,000 characters').optional(),
  max_group_size: z.number().int().min(1, 'At least 1').max(500, 'Too high').optional(),
  deposit_percent: z.number().int().min(1, 'Between 1 and 100').max(100, 'Between 1 and 100').optional(),
  cancellation_policy: z.string().max(2000, 'Keep this under 2,000 characters').optional(),
  is_published: z.boolean(),
})

export type ExperienceFormValues = z.infer<typeof experienceSchema>

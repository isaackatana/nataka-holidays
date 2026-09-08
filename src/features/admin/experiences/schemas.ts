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
  is_published: z.boolean(),
})

export type ExperienceFormValues = z.infer<typeof experienceSchema>

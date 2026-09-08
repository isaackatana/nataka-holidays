import { z } from 'zod'

export const businessSettingsSchema = z.object({
  business_name: z.string().min(2, 'Business name is required'),
  contact_phone: z.string().optional(),
  contact_email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  address: z.string().optional(),
  about_blurb: z.string().optional(),
  instagram_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  facebook_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  hero_video_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  hero_image_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
})

export type BusinessSettingsFormValues = z.infer<typeof businessSettingsSchema>

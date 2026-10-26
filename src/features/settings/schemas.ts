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
  shop_low_stock_threshold: z.number({ message: 'Enter a number' }).int('Whole numbers only').min(0, 'Cannot be negative').max(100, 'That is too high'),
  shop_delivery_fee: z.number({ message: 'Enter a number' }).int('Whole shillings only').min(0, 'Cannot be negative').max(10000, 'That is too high'),
})

export type BusinessSettingsFormValues = z.infer<typeof businessSettingsSchema>

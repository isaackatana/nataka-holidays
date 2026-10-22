import { z } from 'zod'

export const experienceRequestSchema = z.object({
  guestName: z.string().min(2, 'Enter your full name').max(120, 'Name is too long'),
  guestEmail: z.string().min(1, 'Email is required').max(254, 'Email is too long').email('Enter a valid email address'),
  guestPhone: z.string().min(7, 'Enter a valid phone number').max(40, 'Phone number is too long'),
  preferredDate: z.string().min(1, 'Choose a date'),
  people: z
    .number({ error: 'Enter how many people' })
    .int('Whole numbers only')
    .min(1, 'At least 1 person')
    .max(100, 'Too many people'),
  message: z.string().max(1000, 'Message is too long (1,000 characters max)').optional(),
})

export type ExperienceRequestValues = z.infer<typeof experienceRequestSchema>

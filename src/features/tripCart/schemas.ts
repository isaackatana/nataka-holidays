import { z } from 'zod'

export const tripRequestSchema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  phone: z.string().min(7, 'Enter a valid phone number'),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  guests: z.number().min(1, 'At least 1 guest').optional(),
  message: z.string().optional(),
})

export type TripRequestValues = z.infer<typeof tripRequestSchema>

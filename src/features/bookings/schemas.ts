import { z } from 'zod'

export const bookingEnquirySchema = z
  .object({
    guestName: z.string().min(2, 'Enter your full name').max(120, 'Name is too long'),
    guestEmail: z.string().min(1, 'Email is required').max(254, 'Email is too long').email('Enter a valid email address'),
    guestPhone: z.string().min(7, 'Enter a valid phone number').max(40, 'Phone number is too long'),
    checkIn: z.string().min(1, 'Select a check-in date'),
    checkOut: z.string().min(1, 'Select a check-out date'),
    guests: z.number().min(1, 'At least 1 guest').max(100, 'Too many guests'),
    message: z.string().max(2000, 'Message is too long (2,000 characters max)').optional(),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  })

export type BookingEnquiryValues = z.infer<typeof bookingEnquirySchema>

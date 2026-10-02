import { z } from 'zod'

export const contactFormSchema = z.object({
  name: z.string().min(2, 'Enter your name').max(120, 'Name is too long'),
  email: z.string().min(1, 'Email is required').max(254, 'Email is too long').email('Enter a valid email address'),
  phone: z.string().max(40, 'Phone number is too long').optional(),
  subject: z.string().max(200, 'Subject is too long').optional(),
  message: z.string().min(10, 'Tell us a bit more (at least 10 characters)').max(5000, 'Message is too long (5,000 characters max)'),
})

export type ContactFormValues = z.infer<typeof contactFormSchema>

import { supabase } from '@/lib/supabase'
import type { BookingStatus } from '@/types/domain'
import { notifyBooking } from '@/services/notify.service'

export interface CreateBookingInput {
  propertyId: string
  customerId: string | null
  guestName: string
  guestEmail: string
  guestPhone: string
  checkIn: string
  checkOut: string
  guests: number
  message?: string
  estimatedTotal: number
}

export async function createBookingEnquiry(input: CreateBookingInput): Promise<{ id: string }> {
  // The id is generated here rather than read back from the insert. Reading
  // the new row back (.select()) needs SELECT permission, and RLS only
  // lets a booking's own customer or an admin read it — so for a guest
  // checking out without an account, insert-and-return would be rejected
  // even though the insert itself is allowed.
  const id = crypto.randomUUID()
  const { error } = await supabase.from('bookings').insert({
    id,
    property_id: input.propertyId,
    customer_id: input.customerId,
    guest_name: input.guestName,
    guest_email: input.guestEmail,
    guest_phone: input.guestPhone,
    check_in: input.checkIn,
    check_out: input.checkOut,
    guests: input.guests,
    message: input.message ?? null,
    estimated_total: input.estimatedTotal,
  } as never)

  if (error) throw error
  notifyBooking('enquiry', id)
  return { id }
}

export interface BookingBlock {
  start_date: string
  end_date: string
}

export async function getBookingBlocks(propertyId: string): Promise<BookingBlock[]> {
  const { data, error } = await supabase
    .from('booking_blocks')
    .select('start_date, end_date')
    .eq('property_id', propertyId)
    .order('start_date')

  if (error) throw error
  return (data ?? []) as unknown as BookingBlock[]
}

export interface MyBooking {
  id: string
  property_id: string
  guest_phone: string
  check_in: string
  check_out: string
  guests: number
  nights: number
  estimated_total: number | null
  status: BookingStatus
  created_at: string
  properties: { title: string; slug: string } | null
}

export async function getMyBookings(customerId: string): Promise<MyBooking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, property_id, guest_phone, check_in, check_out, guests, nights, estimated_total, status, created_at, properties ( title, slug )',
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as MyBooking[]
}

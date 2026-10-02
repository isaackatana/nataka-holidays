import { supabase } from '@/lib/supabase'
import type { BookingStatus } from '@/types/domain'
import { notifyBooking } from '@/services/notify.service'

export interface AdminBooking {
  id: string
  property_id: string | null
  customer_id: string | null
  guest_name: string
  guest_email: string
  guest_phone: string
  check_in: string
  check_out: string
  guests: number
  nights: number
  message: string | null
  estimated_total: number | null
  status: BookingStatus
  created_at: string
  properties: { title: string; slug: string } | null
}

export interface AdminBookingFilters {
  status?: BookingStatus
  search?: string // matches guest name or email
}

export async function getAllBookingsForAdmin(filters: AdminBookingFilters = {}): Promise<AdminBooking[]> {
  let query = supabase
    .from('bookings')
    .select(
      'id, property_id, customer_id, guest_name, guest_email, guest_phone, check_in, check_out, guests, nights, message, estimated_total, status, created_at, properties ( title, slug )',
    )
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.search) {
    query = query.or(`guest_name.ilike.%${filters.search}%,guest_email.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as AdminBooking[]
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { error } = await supabase.from('bookings').update({ status } as never).eq('id', id)
  if (error) throw error
  // Only reached if the database accepted the change (e.g. a confirmation
  // that would double-book is refused above and sends nothing).
  if (status === 'confirmed' || status === 'cancelled') notifyBooking(status, id)
}

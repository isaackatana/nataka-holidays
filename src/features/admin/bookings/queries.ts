import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAllBookingsForAdmin,
  updateBookingStatus,
  type AdminBookingFilters,
} from '@/services/admin/bookings.service'
import type { BookingStatus } from '@/types/domain'

export function useAdminBookings(filters: AdminBookingFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'bookings', 'list', filters],
    queryFn: () => getAllBookingsForAdmin(filters),
  })
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) => updateBookingStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard-stats'] })
      // Confirming/cancelling changes which dates are blocked (DB trigger).
      queryClient.invalidateQueries({ queryKey: ['admin', 'booking-blocks'] })
      queryClient.invalidateQueries({ queryKey: ['booking-blocks'] })
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      // The customer's own "My Bookings" view is keyed by their user id,
      // which this admin session doesn't know — it'll pick up the new
      // status on its own next fetch (React Query's default staleTime),
      // not instantly, since there's no realtime subscription here.
    },
  })
}

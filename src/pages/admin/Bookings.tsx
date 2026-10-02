import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, Mail, Phone } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useAdminBookings, useUpdateBookingStatus } from '@/features/admin/bookings/queries'
import { PaymentPanel } from '@/features/admin/payments/PaymentPanel'
import { usePayments } from '@/features/admin/payments/queries'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDateRange } from '@/utils/dates'
import { buildGuestStatusMessage, buildGuestWhatsAppLink } from '@/utils/phone'
import { formatKES } from '@/utils/currency'
import type { BookingStatus } from '@/types/domain'
import { sumPaid } from '@/utils/payments'

const STATUS_TABS: { value: BookingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const ALL_STATUSES: BookingStatus[] = ['pending', 'contacted', 'confirmed', 'completed', 'cancelled']

export default function AdminBookings() {
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 300)

  const filters = useMemo(
    () => ({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: debouncedSearch || undefined,
    }),
    [statusFilter, debouncedSearch],
  )

  const { data: bookings, isLoading } = useAdminBookings(filters)
  const updateStatus = useUpdateBookingStatus()
  const { data: payments } = usePayments()
  const paymentsFor = (bookingId: string) => (payments ?? []).filter((p) => p.booking_id === bookingId)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-2xl font-medium text-teal-900">Bookings</h1>
      <p className="mt-1 text-sm text-charcoal-500">Enquiries from the booking form, newest first.</p>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-teal-900 text-sand-50'
                  : 'bg-sand-100 text-charcoal-600 hover:bg-sand-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-sand-300 bg-sand-50 px-4 py-2 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-300 focus:border-teal-700 sm:w-64"
        />
      </div>

      {updateStatus.isError && (
        <p role="alert" className="mt-4 rounded-lg bg-coral-500/10 px-4 py-3 text-sm text-coral-500">
          {/* Supabase errors are plain objects with a `message`, not Error instances. */}
          {(updateStatus.error as { message?: string } | null)?.message || 'Could not update that booking.'}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-card border border-sand-200 bg-sand-50">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-sand-200 bg-sand-100 text-xs uppercase tracking-wide text-charcoal-500">
            <tr>
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-10 animate-pulse rounded bg-sand-200" />
                  </td>
                </tr>
              ))}

            {!isLoading && bookings?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-charcoal-500">
                  No bookings match this view.
                </td>
              </tr>
            )}

            {bookings?.map((booking) => (
              <Fragment key={booking.id}>
                <tr className="hover:bg-sand-100/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-charcoal-900">{booking.guest_name}</p>
                    <p className="text-xs text-charcoal-500">{booking.guest_email}</p>
                  </td>
                  <td className="px-4 py-3 text-charcoal-700">
                    {booking.properties ? (
                      <Link to={`/stays/${booking.properties.slug}`} className="hover:underline">
                        {booking.properties.title}
                      </Link>
                    ) : (
                      <span className="text-charcoal-400">Deleted property</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-charcoal-700">
                    {formatDateRange(booking.check_in, booking.check_out)}
                    <span className="text-charcoal-400"> · {booking.nights}n</span>
                  </td>
                  <td className="px-4 py-3 font-figures text-charcoal-700">
                    {booking.estimated_total !== null ? formatKES(booking.estimated_total) : '—'}
                    {sumPaid(paymentsFor(booking.id)) > 0 && (
                      <span className="block text-xs text-palm-green">
                        Paid {formatKES(sumPaid(paymentsFor(booking.id)))}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={booking.status}
                      onChange={(e) =>
                        updateStatus.mutate({ id: booking.id, status: e.target.value as BookingStatus })
                      }
                      className="rounded-lg border border-sand-300 bg-sand-50 px-2 py-1.5 text-xs font-medium text-charcoal-900 outline-none focus:border-teal-700"
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}
                      aria-label="Toggle details"
                      className="text-charcoal-500 hover:text-teal-800"
                    >
                      {expandedId === booking.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                </tr>
                {expandedId === booking.id && (
                  <tr className="bg-sand-100/60">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="flex flex-col gap-2 text-sm text-charcoal-700 sm:flex-row sm:items-center sm:gap-6">
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          {booking.guest_email}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {booking.guest_phone}
                        </span>
                        <span>{booking.guests} guests</span>
                        {(() => {
                          const link = buildGuestWhatsAppLink(
                            booking.guest_phone,
                            buildGuestStatusMessage({
                              guestName: booking.guest_name,
                              propertyTitle: booking.properties?.title ?? null,
                              dates: formatDateRange(booking.check_in, booking.check_out),
                              status: booking.status,
                            }),
                          )
                          return link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-teal-800 hover:underline"
                            >
                              WhatsApp guest
                            </a>
                          ) : null
                        })()}
                        <StatusBadge status={booking.status} />
                      </div>
                      {booking.message && (
                        <p className="mt-3 rounded-lg bg-sand-50 p-3 text-sm text-charcoal-700">
                          "{booking.message}"
                        </p>
                      )}
                      <PaymentPanel
                        bookingId={booking.id}
                        guestPhone={booking.guest_phone}
                        estimatedTotal={booking.estimated_total}
                        payments={paymentsFor(booking.id)}
                        canRequest={booking.status !== 'cancelled' && booking.status !== 'completed'}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

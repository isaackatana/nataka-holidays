import { useMemo, useState } from 'react'
import { Banknote, CalendarCheck, Download, Percent, Wallet } from 'lucide-react'
import { StatCard } from '@/components/admin/StatCard'
import { useAdminBookings } from '@/features/admin/bookings/queries'
import { usePayments } from '@/features/admin/payments/queries'
import { useAdminProperties } from '@/features/admin/properties/queries'
import {
  PERIOD_LABELS,
  bookingsToCsv,
  buildReport,
  periodWindow,
  upcomingArrivals,
  type ReportBooking,
  type ReportPeriod,
} from '@/utils/reports'
import { formatDateRange, todayISO } from '@/utils/dates'
import { formatKES } from '@/utils/currency'
import { buildGuestWhatsAppLink } from '@/utils/phone'

const PERIODS = Object.keys(PERIOD_LABELS) as ReportPeriod[]

export default function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>('this-month')
  const { data: bookings, isLoading: bookingsLoading, isError } = useAdminBookings()
  const { data: payments, isLoading: paymentsLoading } = usePayments()
  const { data: properties, isLoading: propertiesLoading } = useAdminProperties()

  const loading = bookingsLoading || paymentsLoading || propertiesLoading
  const today = todayISO()
  const window = useMemo(() => periodWindow(period, today), [period, today])

  // AdminBooking and the report types are structurally compatible; the
  // cast just narrows the status union the report code relies on.
  const reportBookings = useMemo(() => (bookings ?? []) as unknown as ReportBooking[], [bookings])
  const reportPayments = useMemo(() => payments ?? [], [payments])

  const report = useMemo(
    () =>
      buildReport({
        bookings: reportBookings,
        payments: reportPayments,
        properties: (properties ?? []).map((p) => ({
          id: p.id,
          title: p.title,
        })),
        window,
      }),
    [reportBookings, reportPayments, properties, window],
  )
  const arrivals = useMemo(
    () => upcomingArrivals(reportBookings, reportPayments, today, 14),
    [reportBookings, reportPayments, today],
  )

  function downloadCsv() {
    // Bookings whose stay overlaps the selected period.
    const inPeriod = reportBookings.filter(
      (b) => b.check_in < window.to && b.check_out > window.from,
    )
    const blob = new Blob(['\uFEFF' + bookingsToCsv(inPeriod, reportPayments)], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nataka-bookings-${window.from}-to-${window.to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium text-teal-900">Reports</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            {formatDateRange(window.from, window.to)} · only confirmed and completed bookings count
            as revenue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="report-period">
            Period
          </label>
          <select
            id="report-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
            className="rounded-lg border border-sand-400 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm font-medium text-teal-900 hover:bg-sand-200 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
        </div>
      </div>

      {isError && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-coral-500/10 px-4 py-3 text-sm text-coral-500"
        >
          Could not load the report data. Please refresh.
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Collected"
          value={report.collected}
          icon={Banknote}
          loading={loading}
          format={formatKES}
        />
        <StatCard
          label="Booked value"
          value={report.bookedValue}
          icon={CalendarCheck}
          loading={loading}
          format={formatKES}
        />
        <StatCard
          label="Balance still owed"
          value={report.outstanding}
          icon={Wallet}
          loading={loading}
          format={formatKES}
        />
        <StatCard
          label="Enquiry → booking"
          value={report.conversion === null ? 0 : Math.round(report.conversion * 100)}
          icon={Percent}
          loading={loading}
          format={(v) => (report.conversion === null ? '—' : `${v}%`)}
        />
      </div>
      <p className="mt-2 text-xs text-charcoal-600">
        Collected = payments received in the period (M-Pesa, cash and bank). Booked value = totals
        of stays starting in the period. Balance owed covers every confirmed booking, whenever it
        falls. {report.enquiriesReceived} enquir
        {report.enquiriesReceived === 1 ? 'y' : 'ies'} received in the period.
      </p>

      {/* ---------------- PER PROPERTY ---------------- */}
      <div className="mt-10 rounded-card border border-sand-200 bg-sand-50 p-5">
        <h2 className="font-display text-lg font-medium text-teal-900">By property</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">
              Bookings, occupancy and revenue by property for the selected period
            </caption>
            <thead>
              <tr className="border-b border-sand-200 text-xs uppercase tracking-wide text-charcoal-500">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Property
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Stays
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Booked nights
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Occupancy
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Booked value
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Collected
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-6">
                    <div className="h-6 animate-pulse rounded bg-sand-200" />
                  </td>
                </tr>
              )}
              {!loading && report.perProperty.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-charcoal-500">
                    No properties yet.
                  </td>
                </tr>
              )}
              {report.perProperty.map((row) => (
                <tr key={row.propertyId}>
                  <td className="py-3 pr-4 font-medium text-charcoal-900">{row.title}</td>
                  <td className="py-3 pr-4 font-figures">{row.bookings}</td>
                  <td className="py-3 pr-4 font-figures">{row.bookedNights}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 w-20 overflow-hidden rounded-full bg-sand-200"
                        aria-hidden
                      >
                        <div
                          className="h-full bg-teal-700"
                          style={{
                            width: `${Math.round(row.occupancy * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="font-figures">{Math.round(row.occupancy * 100)}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right font-figures">
                    {formatKES(row.bookedValue)}
                  </td>
                  <td className="py-3 text-right font-figures">{formatKES(row.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-charcoal-600">
          Occupancy = booked nights ÷ nights in the period, so future bookings in the period count.
        </p>
      </div>

      {/* ---------------- ARRIVALS ---------------- */}
      <div className="mt-6 rounded-card border border-sand-200 bg-sand-50 p-5">
        <h2 className="font-display text-lg font-medium text-teal-900">
          Arriving in the next 14 days
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          {!loading && arrivals.length === 0 && (
            <p className="py-4 text-center text-sm text-charcoal-500">
              No confirmed arrivals in the next 14 days.
            </p>
          )}
          {arrivals.map(({ booking, balance }) => {
            const link = buildGuestWhatsAppLink(
              booking.guest_phone,
              balance > 0
                ? `Hello ${booking.guest_name.split(' ')[0]}, a reminder that ${formatKES(balance)} is still due for your stay at ${booking.properties?.title ?? 'Nataka Holidays'}. We can send an M-Pesa prompt to this number if that's easiest.`
                : `Hello ${booking.guest_name.split(' ')[0]}, we're looking forward to welcoming you at ${booking.properties?.title ?? 'Nataka Holidays'}!`,
            )
            return (
              <div
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sand-100 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-charcoal-900">
                    {booking.guest_name} · {booking.properties?.title ?? 'Deleted property'}
                  </p>
                  <p className="text-xs text-charcoal-500">
                    {formatDateRange(booking.check_in, booking.check_out)} · {booking.guests} guest
                    {booking.guests === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className={`font-figures ${balance > 0 ? 'font-medium text-coral-500' : 'text-palm-green'}`}
                  >
                    {balance > 0 ? `${formatKES(balance)} due` : 'Paid in full'}
                  </span>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-teal-800 hover:underline"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

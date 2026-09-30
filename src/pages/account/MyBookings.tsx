import { Link } from "react-router-dom";
import { CalendarCheck, Users, MapPin } from "lucide-react";
import { SEO } from "@/components/shared/SEO";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/features/auth/AuthContext";
import { useMyBookings } from "@/features/bookings/queries";
import { usePayments } from "@/features/admin/payments/queries";
import { PayBookingPanel } from "@/features/bookings/PayBookingPanel";
import { formatDateRange } from "@/utils/dates";
import { formatKES } from "@/utils/currency";
import { sumPaid } from "@/utils/payments";

export default function MyBookings() {
  const { user } = useAuth();
  const { data: bookings, isLoading, isError } = useMyBookings(user?.id);
  // RLS limits this to payments on the signed-in customer's own bookings.
  const { data: payments } = usePayments();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <SEO
        title="My Bookings"
        description="Your booking enquiries with Nataka Holidays."
        noindex
      />

      <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">
        My bookings
      </h1>
      <p className="mt-2 text-charcoal-500">
        Enquiries you've sent, and where they stand.
      </p>

      {isError && (
        <p className="mt-8 rounded-card bg-coral-500/10 p-6 text-sm text-coral-500">
          Something went wrong loading your bookings. Please try again.
        </p>
      )}

      {!isError && (
        <div className="mt-8 flex flex-col gap-4">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-card bg-sand-200"
              />
            ))}

          {!isLoading && bookings?.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-card bg-sand-100 py-16 text-center">
              <CalendarCheck className="h-10 w-10 text-sand-300" />
              <p className="text-charcoal-500">
                You haven't sent any booking enquiries yet.
              </p>
              <Link
                to="/holiday-homes"
                className="rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
              >
                Browse holiday homes
              </Link>
            </div>
          )}

          {bookings?.map((booking) => (
            <div
              key={booking.id}
              className="rounded-card border border-sand-200 bg-sand-50 p-5 shadow-card"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1.5">
                  {booking.properties ? (
                    <Link
                      to={`/stays/${booking.properties.slug}`}
                      className="flex items-center gap-1.5 font-display text-lg font-medium text-teal-900 hover:underline"
                    >
                      <MapPin className="h-4 w-4 shrink-0" />
                      {booking.properties.title}
                    </Link>
                  ) : (
                    <span className="font-display text-lg font-medium text-charcoal-500">
                      Property no longer available
                    </span>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-charcoal-500">
                    <span className="flex items-center gap-1.5">
                      <CalendarCheck className="h-4 w-4" />
                      {formatDateRange(
                        booking.check_in,
                        booking.check_out,
                      )} · {booking.nights} night
                      {booking.nights === 1 ? "" : "s"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      {booking.guests} guest{booking.guests === 1 ? "" : "s"}
                    </span>
                  </div>

                  {booking.estimated_total !== null && (
                    <span className="font-figures text-sm text-charcoal-700">
                      Estimated total: {formatKES(booking.estimated_total)}
                    </span>
                  )}

                  {sumPaid(
                    (payments ?? []).filter((p) => p.booking_id === booking.id),
                  ) > 0 && (
                    <span className="font-figures text-sm text-palm-green">
                      Paid via M-Pesa:{" "}
                      {formatKES(
                        sumPaid(
                          (payments ?? []).filter(
                            (p) => p.booking_id === booking.id,
                          ),
                        ),
                      )}
                    </span>
                  )}
                </div>

                <div className="shrink-0">
                  <StatusBadge status={booking.status} />
                </div>
              </div>

              {booking.status === "confirmed" &&
                booking.estimated_total !== null && (
                  <PayBookingPanel
                    bookingId={booking.id}
                    guestPhone={booking.guest_phone}
                    estimatedTotal={booking.estimated_total}
                    payments={(payments ?? []).filter(
                      (p) => p.booking_id === booking.id,
                    )}
                  />
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

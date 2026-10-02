import { Link } from 'react-router-dom'
import { Home, CheckCircle2, Clock, CalendarCheck, Users, TrendingUp } from 'lucide-react'
import { StatCard } from '@/components/admin/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  useDashboardStats,
  useRecentEnquiries,
  useRecentUsers,
  usePopularProperties,
} from '@/features/admin/queries'
import { formatDateRange } from '@/utils/dates'
import { formatKES } from '@/utils/currency'

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: enquiries, isLoading: enquiriesLoading } = useRecentEnquiries(5)
  const { data: users, isLoading: usersLoading } = useRecentUsers(5)
  const { data: popular, isLoading: popularLoading } = usePopularProperties(5)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-2xl font-medium text-teal-900">Dashboard</h1>
      <p className="mt-1 text-sm text-charcoal-500">An overview of Nataka Holidays right now.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total properties" value={stats?.totalProperties} icon={Home} loading={statsLoading} />
        <StatCard
          label="Published"
          value={stats?.publishedProperties}
          icon={CheckCircle2}
          loading={statsLoading}
        />
        <StatCard label="Pending enquiries" value={stats?.pendingEnquiries} icon={Clock} loading={statsLoading} />
        <StatCard
          label="Confirmed bookings"
          value={stats?.confirmedBookings}
          icon={CalendarCheck}
          loading={statsLoading}
        />
        <StatCard label="Total customers" value={stats?.totalCustomers} icon={Users} loading={statsLoading} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ---------------- RECENT ENQUIRIES ---------------- */}
        <div className="rounded-card border border-sand-200 bg-sand-50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium text-teal-900">Recent enquiries</h2>
            <Link to="/admin/bookings" className="text-xs font-medium text-teal-800 hover:underline">
              View all
            </Link>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {enquiriesLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-sand-200" />
              ))}

            {!enquiriesLoading && enquiries?.length === 0 && (
              <p className="py-6 text-center text-sm text-charcoal-500">No enquiries yet.</p>
            )}

            {enquiries?.map((enquiry) => (
              <div
                key={enquiry.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-sand-100 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-charcoal-900">
                    {enquiry.guest_name} · {enquiry.properties?.title ?? 'Deleted property'}
                  </p>
                  <p className="text-xs text-charcoal-500">
                    {formatDateRange(enquiry.check_in, enquiry.check_out)}
                  </p>
                </div>
                <StatusBadge status={enquiry.status} />
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- RECENT USERS ---------------- */}
        <div className="rounded-card border border-sand-200 bg-sand-50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium text-teal-900">Recent users</h2>
            <Link to="/admin/customers" className="text-xs font-medium text-teal-800 hover:underline">
              View all
            </Link>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {usersLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-sand-200" />
              ))}

            {!usersLoading && users?.length === 0 && (
              <p className="py-6 text-center text-sm text-charcoal-500">No users yet.</p>
            )}

            {users?.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg bg-sand-100 px-4 py-3">
                <span className="text-sm font-medium text-charcoal-900">{u.full_name ?? 'Unnamed'}</span>
                <span className="font-mono text-[11px] uppercase tracking-wide text-charcoal-500">{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- POPULAR PROPERTIES ---------------- */}
      <div className="mt-6 rounded-card border border-sand-200 bg-sand-50 p-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-teal-800" />
          <h2 className="font-display text-lg font-medium text-teal-900">Popular properties</h2>
        </div>
        <p className="mt-0.5 text-xs text-charcoal-500">Ranked by number of booking enquiries received.</p>

        <div className="mt-4 flex flex-col gap-2">
          {popularLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-sand-200" />
            ))}

          {!popularLoading && popular?.length === 0 && (
            <p className="py-6 text-center text-sm text-charcoal-500">
              No enquiries yet — this fills in once bookings start coming through.
            </p>
          )}

          {popular?.map((property, i) => (
            <Link
              key={property.id}
              to={`/admin/properties/${property.id}/edit`}
              className="flex items-center justify-between gap-3 rounded-lg bg-sand-100 px-4 py-3 hover:bg-sand-200"
            >
              <span className="flex items-center gap-3">
                <span className="font-mono text-xs text-charcoal-600">#{i + 1}</span>
                <span className="text-sm font-medium text-charcoal-900">{property.title}</span>
              </span>
              <span className="flex items-center gap-4 text-xs text-charcoal-500">
                <span className="font-figures">{formatKES(property.price_per_night)}/night</span>
                <span>
                  {property.enquiryCount} enquir{property.enquiryCount === 1 ? 'y' : 'ies'}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useAuth } from '@/features/auth/AuthContext'
import { useMyExperienceRequests } from '@/features/experienceRequests/queries'
import { useMyExperienceReviews } from '@/features/experienceReviews/queries'
import { ReviewExperiencePanel } from '@/features/experienceReviews/ReviewExperiencePanel'
import { PayExperiencePanel } from '@/features/experienceRequests/PayExperiencePanel'
import { useMyExperiencePayments } from '@/features/experienceRequests/paymentQueries'
import type { ExperienceRequestStatus } from '@/services/experienceRequests.service'
import { formatKES } from '@/utils/currency'

const STATUS: Record<ExperienceRequestStatus, { label: string; className: string }> = {
  new: { label: 'Awaiting confirmation', className: 'bg-gold-500/15 text-charcoal-700' },
  confirmed: { label: 'Confirmed', className: 'bg-palm-green/15 text-palm-green' },
  declined: { label: 'Not available', className: 'bg-coral-500/10 text-coral-500' },
  cancelled: { label: 'Cancelled', className: 'bg-sand-200 text-charcoal-600' },
  completed: { label: 'Completed', className: 'bg-teal-900/10 text-teal-900' },
}

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-KE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

/** The signed-in guest's experience requests and where each one stands. Hidden when they have none. */
export function MyExperienceRequests() {
  const { user, profile } = useAuth()
  const { data: requests } = useMyExperienceRequests(user?.id)
  const { data: myReviews } = useMyExperienceReviews(user?.id)
  const { data: myPayments } = useMyExperiencePayments(user?.id)
  if (!requests || requests.length === 0) return null

  return (
    <section className="mt-12" aria-labelledby="my-experience-requests">
      <h2 id="my-experience-requests" className="font-display text-2xl font-medium text-teal-900">
        My experience requests
      </h2>
      <ul className="mt-4 flex flex-col gap-3">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-sand-200 bg-sand-50 p-4"
          >
            <div>
              <p className="font-medium text-teal-900">{r.experience_title}</p>
              <p className="text-sm text-charcoal-600">
                {longDate(r.preferred_date)} · {r.people} {r.people === 1 ? 'person' : 'people'}
                {r.estimated_total !== null && <> · est. {formatKES(r.estimated_total)}</>}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[r.status].className}`}>
              {STATUS[r.status].label}
            </span>

            {(r.status === 'confirmed' || r.status === 'completed') && (
              <PayExperiencePanel
                requestId={r.id}
                confirmed={r.status === 'confirmed'}
                defaultPhone={profile?.phone ?? ''}
                payments={(myPayments ?? []).filter((p) => p.request_id === r.id)}
              />
            )}

            {r.status === 'completed' && user && r.experience_id && (
              <ReviewExperiencePanel
                customerId={user.id}
                experienceId={r.experience_id}
                requestId={r.id}
                review={myReviews?.find((rv) => rv.request_id === r.id)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

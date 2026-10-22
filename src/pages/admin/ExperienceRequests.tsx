import { useState } from 'react'
import { MessageCircle, Trash2 } from 'lucide-react'
import { ExperienceRequestPayments } from '@/components/admin/ExperienceRequestPayments'
import {
  useAdminExperiencePayments,
  useAdminExperienceRequests,
  useDeleteExperienceRequest,
  useUpdateExperienceRequestStatus,
} from '@/features/admin/experienceRequests/queries'
import type { ExperienceRequestStatus } from '@/services/experienceRequests.service'
import { buildExperienceRequestMessage, buildGuestWhatsAppLink } from '@/utils/phone'
import { formatKES } from '@/utils/currency'

const TABS: { value: ExperienceRequestStatus | 'all'; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'declined', label: 'Declined' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
]

const STATUS_STYLE: Record<ExperienceRequestStatus, string> = {
  new: 'bg-gold-500/15 text-charcoal-700',
  confirmed: 'bg-palm-green/15 text-palm-green',
  declined: 'bg-coral-500/10 text-coral-500',
  cancelled: 'bg-sand-200 text-charcoal-600',
  completed: 'bg-teal-900/10 text-teal-900',
}

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-KE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export default function AdminExperienceRequests() {
  const [tab, setTab] = useState<ExperienceRequestStatus | 'all'>('new')
  const { data: requests, isLoading, isError } = useAdminExperienceRequests(tab === 'all' ? undefined : tab)
  const { data: allPayments } = useAdminExperiencePayments()
  const updateStatus = useUpdateExperienceRequestStatus()
  const deleteRequest = useDeleteExperienceRequest()

  function handleDelete(id: string) {
    if (!window.confirm("Delete this request? This can't be undone.")) return
    deleteRequest.mutate(id)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-2xl font-medium text-teal-900">Experience requests</h1>
      <p className="mt-1 text-sm text-charcoal-500">
        Guests who asked to join an experience. Confirm or decline, then message them on WhatsApp.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Request status">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              tab === t.value
                ? 'border-teal-900 bg-teal-900 text-sand-50'
                : 'border-sand-300 bg-sand-50 text-charcoal-700 hover:border-teal-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-6 text-charcoal-500">Loading...</p>}
      {isError && (
        <p className="mt-6 text-sm text-coral-500">
          Couldn't load requests. If you haven't yet, run migrations 0025_experience_requests.sql and 0027_experience_payments.sql in Supabase.
        </p>
      )}
      {requests && requests.length === 0 && (
        <p className="mt-6 text-charcoal-500">No {tab === 'all' ? '' : `${tab} `}requests.</p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {requests?.map((r) => {
          const whatsapp = buildGuestWhatsAppLink(
            r.guest_phone,
            buildExperienceRequestMessage({
              guestName: r.guest_name,
              experienceTitle: r.experience_title,
              date: longDate(r.preferred_date),
              people: r.people,
              status: r.status,
            }),
          )
          return (
            <li key={r.id} className="rounded-card border border-sand-200 bg-sand-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-medium text-teal-900">{r.experience_title}</h2>
                  <p className="text-sm text-charcoal-700">
                    {longDate(r.preferred_date)} · {r.people} {r.people === 1 ? 'person' : 'people'}
                    {r.estimated_total !== null && <> · est. {formatKES(r.estimated_total)}</>}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[r.status]}`}>
                  {r.status}
                </span>
              </div>

              <p className="mt-3 text-sm text-charcoal-700">
                <strong>{r.guest_name}</strong> · {r.guest_phone} ·{' '}
                <a href={`mailto:${r.guest_email}`} className="text-teal-800 hover:underline">
                  {r.guest_email}
                </a>
              </p>
              {r.message && <p className="mt-2 whitespace-pre-line text-sm italic text-charcoal-600">“{r.message}”</p>}

              {r.status !== 'new' && r.status !== 'declined' || (allPayments ?? []).some((p) => p.request_id === r.id) ? (
                <ExperienceRequestPayments
                  request={r}
                  payments={(allPayments ?? []).filter((p) => p.request_id === r.id)}
                />
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {r.status === 'new' && (
                  <>
                    <button
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: r.id, status: 'confirmed' })}
                      className="rounded-full bg-teal-900 px-4 py-1.5 text-xs font-medium text-sand-50 hover:bg-teal-800 disabled:opacity-60"
                    >
                      Confirm
                    </button>
                    <button
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: r.id, status: 'declined' })}
                      className="rounded-full border border-sand-300 px-4 py-1.5 text-xs font-medium text-charcoal-700 hover:bg-sand-100 disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </>
                )}
                {r.status === 'confirmed' && (
                  <>
                    <button
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: r.id, status: 'completed' })}
                      className="rounded-full bg-teal-900 px-4 py-1.5 text-xs font-medium text-sand-50 hover:bg-teal-800 disabled:opacity-60"
                    >
                      Mark completed
                    </button>
                    <button
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: r.id, status: 'cancelled' })}
                      className="rounded-full border border-sand-300 px-4 py-1.5 text-xs font-medium text-charcoal-700 hover:bg-sand-100 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {whatsapp && (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-sand-300 px-4 py-1.5 text-xs font-medium text-teal-800 hover:bg-sand-100"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp guest
                  </a>
                )}
                <button
                  aria-label="Delete request"
                  onClick={() => handleDelete(r.id)}
                  className="ml-auto flex items-center gap-1 text-xs text-coral-500 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

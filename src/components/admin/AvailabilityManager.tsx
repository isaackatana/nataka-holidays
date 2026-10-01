import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAdminBlocks, useCreateBlock, useDeleteBlock } from '@/features/admin/bookingBlocks/queries'
import { formatDateRange, rangesOverlap, todayISO } from '@/utils/dates'

/** Admin: see what's blocked and add manual blocks (owner stays,
 * maintenance). Blocks from confirmed bookings are managed automatically
 * by booking status, so they can't be deleted here. This is NOT a <form>
 * because it sits inside the property editor's form. */
export function AvailabilityManager({ propertyId }: { propertyId: string }) {
  const { data: blocks, isLoading } = useAdminBlocks(propertyId)
  const create = useCreateBlock()
  const remove = useDeleteBlock()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function add() {
    setError(null)
    if (!start || !end) return setError('Choose both a start and an end date.')
    if (end <= start) return setError('The end date must be after the start date.')
    if ((blocks ?? []).some((b) => rangesOverlap(start, end, b.start_date, b.end_date))) {
      return setError('Those dates overlap something already blocked.')
    }
    create.mutate(
      { propertyId, startDate: start, endDate: end, reason },
      {
        onSuccess: () => {
          setStart('')
          setEnd('')
          setReason('')
        },
        onError: () => setError('Could not save that block. Please try again.'),
      },
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-sand-200 bg-sand-50 p-6">
      <div>
        <h2 className="font-display text-lg font-medium text-teal-900">Availability</h2>
        <p className="mt-1 text-sm text-charcoal-500">
          Confirmed bookings block their dates automatically. Add your own blocks for owner stays or
          maintenance. The end date is the day guests can check in again.
        </p>
      </div>

      {isLoading && <div className="h-10 animate-pulse rounded bg-sand-200" />}
      {!isLoading && (blocks ?? []).length === 0 && (
        <p className="text-sm text-charcoal-500">Nothing blocked from today onwards.</p>
      )}

      <ul className="divide-y divide-sand-200">
        {(blocks ?? []).map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-charcoal-800">{formatDateRange(b.start_date, b.end_date)}</span>
            <span className="flex-1 text-charcoal-500">
              {b.booking_id ? 'Confirmed booking' : b.reason || 'Blocked'}
            </span>
            {b.booking_id ? (
              <span className="text-xs text-charcoal-400">Automatic</span>
            ) : (
              <button
                type="button"
                onClick={() => remove.mutate(b.id)}
                disabled={remove.isPending}
                aria-label="Remove block"
                className="text-charcoal-400 hover:text-coral-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-charcoal-500">
          From
          <input
            type="date"
            min={todayISO()}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-charcoal-500">
          Until
          <input
            type="date"
            min={start || todayISO()}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-charcoal-500">
          Label (public — keep generic, e.g. "Owner stay")
          <input
            type="text"
            maxLength={40}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
          />
        </label>
        <Button type="button" variant="secondary" loading={create.isPending} onClick={add}>
          Block dates
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-coral-500">
          {error}
        </p>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useRecordExperiencePayment, useSetAgreedTotal } from '@/features/admin/experienceRequests/queries'
import type { AdminExperienceRequest } from '@/services/admin/experienceRequests.service'
import type { ExperiencePayment } from '@/services/experiencePayments.service'
import { formatKES } from '@/utils/currency'

interface Props {
  request: AdminExperienceRequest
  payments: ExperiencePayment[]
}

const METHOD_LABEL: Record<ExperiencePayment['method'], string> = {
  mpesa: 'M-Pesa',
  cash: 'Cash',
  bank: 'Bank',
  other: 'Other',
}

/** Money for one experience request: the price, what has been paid, and ways to record it. */
export function ExperienceRequestPayments({ request, payments }: Props) {
  const record = useRecordExperiencePayment()
  const setTotal = useSetAgreedTotal()
  const [agreed, setAgreed] = useState(request.agreed_total != null ? String(request.agreed_total) : '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank' | 'other'>('cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const total = request.agreed_total ?? request.estimated_total
  const paid = payments
    .filter((p) => p.status === 'success')
    .reduce((sum, p) => sum + (p.paid_amount ?? p.amount), 0)
  const hasPending = payments.some((p) => p.status === 'pending')
  const refundHint = (request.status === 'cancelled' || request.status === 'declined') && paid > 0

  async function handleRecord() {
    setError(null)
    const value = Math.floor(Number(amount))
    if (!Number.isFinite(value) || value < 1) {
      setError('Enter an amount of at least 1.')
      return
    }
    try {
      await record.mutateAsync({ requestId: request.id, amount: value, method, note })
      setAmount('')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the payment.')
    }
  }

  async function handleSaveTotal() {
    setError(null)
    const trimmed = agreed.trim()
    const value = trimmed === '' ? null : Number(trimmed)
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setError('Enter a valid total, or leave it empty to use the estimate.')
      return
    }
    try {
      await setTotal.mutateAsync({ requestId: request.id, total: value })
    } catch {
      setError("Couldn't save the total.")
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-sand-200 bg-sand-100/60 p-4 text-sm">
      <p className="font-medium text-teal-900">Payment</p>
      <p className="mt-1 text-charcoal-700">
        {total != null ? (
          <>
            {request.agreed_total != null ? 'Agreed total' : 'Estimated total'}{' '}
            <strong className="font-figures">{formatKES(total)}</strong> · paid{' '}
            <strong className="font-figures">{formatKES(paid)}</strong>
            {total - paid > 0 && <> · balance {formatKES(total - paid)}</>}
            {request.deposit_percent ? <> · online deposit {request.deposit_percent}%</> : <> · online payment off</>}
          </>
        ) : (
          <>No price yet. Set the agreed total below.</>
        )}
      </p>
      {hasPending && <p className="mt-1 text-xs text-charcoal-500">An M-Pesa prompt is waiting for the guest's PIN…</p>}
      {refundHint && (
        <p role="alert" className="mt-2 rounded bg-coral-500/10 px-3 py-2 text-xs text-coral-500">
          Money was received on a {request.status} request. Refund it via M-Pesa.
        </p>
      )}

      {payments.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-charcoal-600">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap gap-x-3">
              <span>{new Date(p.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</span>
              <span>{METHOD_LABEL[p.method]}</span>
              <span className="font-figures">{formatKES(p.paid_amount ?? p.amount)}</span>
              <span className={p.status === 'success' ? 'text-palm-green' : p.status === 'failed' ? 'text-coral-500' : ''}>
                {p.status === 'success' ? 'received' : p.status}
              </span>
              {p.mpesa_receipt && <span className="font-mono">{p.mpesa_receipt}</span>}
              {p.note && <span className="italic">{p.note}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`agreed-${request.id}`} className="text-xs text-charcoal-500">
            Agreed total (KSh, empty = use the estimate)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id={`agreed-${request.id}`}
              type="number"
              min={0}
              value={agreed}
              onChange={(e) => setAgreed(e.target.value)}
              className="w-32 rounded-lg border border-sand-400 bg-sand-50 px-3 py-1.5 text-sm outline-none focus:border-teal-700"
            />
            <button
              type="button"
              disabled={setTotal.isPending}
              onClick={handleSaveTotal}
              className="rounded-full border border-sand-300 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-sand-100 disabled:opacity-60"
            >
              Save total
            </button>
          </div>
        </div>

        <div>
          <span className="text-xs text-charcoal-500">Record cash, bank or other payment</span>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              aria-label="Amount received"
              type="number"
              min={1}
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-24 rounded-lg border border-sand-400 bg-sand-50 px-3 py-1.5 text-sm outline-none focus:border-teal-700"
            />
            <select
              aria-label="Payment method"
              value={method}
              onChange={(e) => setMethod(e.target.value as 'cash' | 'bank' | 'other')}
              className="rounded-lg border border-sand-400 bg-sand-50 px-2 py-1.5 text-sm outline-none focus:border-teal-700"
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </select>
            <input
              aria-label="Payment note"
              placeholder="Note (optional)"
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-sand-400 bg-sand-50 px-3 py-1.5 text-sm outline-none focus:border-teal-700"
            />
            <button
              type="button"
              disabled={record.isPending}
              onClick={handleRecord}
              className="rounded-full bg-teal-900 px-3 py-1.5 text-xs font-medium text-sand-50 hover:bg-teal-800 disabled:opacity-60"
            >
              Record payment
            </button>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="mt-2 text-xs text-coral-500">{error}</p>}
    </div>
  )
}

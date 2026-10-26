import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Plus, Trash2, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCreateDiscountCode, useDeleteDiscountCode, useDiscountCodes, useSetDiscountCodeActive } from '@/features/admin/discounts/queries'
import { discountLabel, discountState, type DiscountState } from '@/features/shop/discountLabel'

const inputClass =
  'w-full rounded-lg border border-sand-400 bg-sand-50 px-4 py-2.5 text-base text-charcoal-900 outline-none placeholder:text-charcoal-500 focus:border-teal-700 sm:text-sm'

const STATE_COPY: Record<DiscountState, { label: string; className: string }> = {
  on: { label: 'Working', className: 'bg-palm-green/15 text-palm-green' },
  off: { label: 'Switched off', className: 'bg-sand-200 text-charcoal-600' },
  expired: { label: 'Expired', className: 'bg-coral-500/10 text-coral-500' },
  'used-up': { label: 'Fully used', className: 'bg-gold-500/15 text-charcoal-700' },
}

interface FormState {
  code: string
  kind: 'percent' | 'amount'
  value: string
  minSubtotal: string
  maxUses: string
  expires: string
  oncePerGuest: boolean
}
const EMPTY: FormState = { code: '', kind: 'percent', value: '', minSubtotal: '', maxUses: '', expires: '', oncePerGuest: true }

export default function AdminDiscounts() {
  const { data: codes, isLoading, isError } = useDiscountCodes()
  const create = useCreateDiscountCode()
  const setActive = useSetDiscountCodeActive()
  const remove = useDeleteDiscountCode()
  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setError(null)
    const code = form.code.trim().toUpperCase()
    const value = Number(form.value)
    const minSubtotal = form.minSubtotal.trim() === '' ? 0 : Number(form.minSubtotal)
    const maxUses = form.maxUses.trim() === '' ? null : Number(form.maxUses)

    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return setError('The code must be 3 to 30 letters, numbers, - or _ (no spaces).')
    if (!Number.isInteger(value) || value < 1) return setError('Enter how much it takes off.')
    if (form.kind === 'percent' && value > 100) return setError('A percentage cannot be more than 100.')
    if (!Number.isInteger(minSubtotal) || minSubtotal < 0) return setError('The minimum spend must be 0 or more.')
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return setError('The use limit must be 1 or more, or empty for no limit.')
    // The date picked is the LAST day the code works.
    const expires_at = form.expires ? new Date(`${form.expires}T23:59:59+03:00`).toISOString() : null

    try {
      await create.mutateAsync({
        code, kind: form.kind, value, min_subtotal: minSubtotal, max_uses: maxUses,
        once_per_guest: form.oncePerGuest, expires_at,
      })
      setForm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the code.')
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-medium text-teal-900">Discount codes</h1>
        {!form && (
          <Button type="button" onClick={() => { setError(null); setForm(EMPTY) }}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New code
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-charcoal-500">
        Guests type a code at shop checkout. It takes money off the items (never the delivery fee) and can never make an order free.
      </p>

      {form && (
        <form onSubmit={onSubmit} className="mt-6 flex max-w-2xl flex-col gap-4 rounded-card bg-sand-50 p-5 shadow-card">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
            Code
            <input className={`${inputClass} uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. WELCOME10" maxLength={30} autoCapitalize="characters" />
            <span className="text-xs font-normal text-charcoal-500">Guests can type it in any case.</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
              Type
              <select className={inputClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as FormState['kind'] })}>
                <option value="percent">Percentage off</option>
                <option value="amount">Fixed amount off (KSh)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
              {form.kind === 'percent' ? 'Percent off' : 'Amount off (KSh)'}
              <input className={inputClass} type="number" inputMode="numeric" min={1} max={form.kind === 'percent' ? 100 : undefined} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
              Minimum spend on items (KSh, optional)
              <input className={inputClass} type="number" inputMode="numeric" min={0} value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
              Total uses allowed (optional)
              <input className={inputClass} type="number" inputMode="numeric" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="No limit" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
              Last day it works (optional)
              <input className={inputClass} type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-charcoal-700">
            <input type="checkbox" checked={form.oncePerGuest} onChange={(e) => setForm({ ...form, oncePerGuest: e.target.checked })} />
            Each guest can use it only once
          </label>

          {error && <p role="alert" className="text-sm text-coral-500">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={create.isPending}>Save code</Button>
            <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </form>
      )}

      {isError && <p className="mt-6 text-sm text-coral-500">Couldn't load the codes. If you haven't yet, run migration 0030_discount_codes.sql in Supabase.</p>}

      <div className="mt-6 flex flex-col gap-3">
        {isLoading && Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-card bg-sand-200" />)}

        {!isLoading && !isError && codes?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-card border border-sand-200 bg-sand-50 py-12 text-center text-charcoal-500">
            <Ticket className="h-8 w-8 text-sand-300" aria-hidden="true" />
            No codes yet.
          </div>
        )}

        {codes?.map((d) => {
          const state = STATE_COPY[discountState(d)]
          return (
            <div key={d.id} className="flex flex-col gap-3 rounded-card border border-sand-200 bg-sand-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-medium text-teal-900">{d.code}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${state.className}`}>{state.label}</span>
                </div>
                <p className="mt-1 text-sm text-charcoal-700">
                  {discountLabel(d)}
                  {d.min_subtotal > 0 && ` · min KSh ${d.min_subtotal.toLocaleString('en-KE')} of items`}
                  {d.once_per_guest && ' · once per guest'}
                </p>
                <p className="mt-0.5 text-xs text-charcoal-500">
                  Used {d.uses}{d.max_uses !== null ? ` of ${d.max_uses}` : ''} time{d.uses === 1 ? '' : 's'}
                  {d.expires_at && ` · works until ${new Date(d.expires_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setActive.mutate({ id: d.id, isActive: !d.is_active })}
                  className="flex items-center gap-1.5 rounded-full border border-sand-300 px-3 py-1.5 text-xs font-medium text-charcoal-700 hover:bg-sand-100"
                >
                  {d.is_active ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                  {d.is_active ? 'Switch off' : 'Switch on'}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${d.code}`}
                  onClick={() => { if (window.confirm(`Delete the code ${d.code}? Orders that used it keep their discount.`)) remove.mutate(d.id) }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-300 text-coral-500 hover:bg-coral-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

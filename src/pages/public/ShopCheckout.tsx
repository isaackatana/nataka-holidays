import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'
import { useBusinessSettings } from '@/features/settings/queries'
import { CartSuggestions } from '@/features/shop/CartSuggestions'
import { useCheckDiscountCode, usePayForOrder, usePlaceOrder } from '@/features/shop/queries'
import { useShopCart } from '@/features/shop/ShopCartContext'
import { orderItems, previewTotal } from '@/features/shop/cart'
import { formatKES } from '@/utils/currency'
import type { Fulfilment } from '@/types/domain'

// Same rule as the server: Safaricom numbers only. The server checks again.
function normalizePhone(input: string): string | null {
  const d = input.replace(/\D/g, '')
  const full = d.startsWith('254') && d.length === 12 ? d : d.startsWith('0') && d.length === 10 ? `254${d.slice(1)}` : d.length === 9 ? `254${d}` : null
  return full && /^254[17]\d{8}$/.test(full) ? full : null
}

const inputClass =
  'w-full rounded-lg border border-sand-400 bg-sand-50 px-4 py-2.5 text-base text-charcoal-900 outline-none placeholder:text-charcoal-500 focus:border-teal-700 sm:text-sm'

export default function ShopCheckout() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const cart = useShopCart()
  const { data: settings } = useBusinessSettings()
  const place = usePlaceOrder()
  const pay = usePayForOrder()
  const checkCode = useCheckDiscountCode()

  const [fulfilment, setFulfilment] = useState<Fulfilment>('handover')
  const [giftWrap, setGiftWrap] = useState(false)
  const [giftMessage, setGiftMessage] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [handoverNote, setHandoverNote] = useState('')
  const [address, setAddress] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeMessage, setCodeMessage] = useState<string | null>(null)
  const [applied, setApplied] = useState<{ code: string; amount: number } | null>(null)

  // Fill in what we already know, once, without overwriting anything typed.
  useEffect(() => {
    if (profile) {
      setName((n) => n || profile.full_name || '')
      setPhone((p) => p || profile.phone || '')
    }
  }, [profile])

  const fee = settings?.shop_delivery_fee ?? 0
  const wrapFee = settings?.shop_gift_wrap_fee ?? 0
  const wrapping = giftWrap && wrapFee > 0
  const total = previewTotal(cart.lines, fulfilment, fee, applied?.amount ?? 0, wrapping ? wrapFee : 0)
  const busy = place.isPending || pay.isPending

  // If the items change after a code was applied, ask again so the preview stays honest.
  const appliedCode = applied?.code
  useEffect(() => {
    if (!appliedCode) return
    let live = true
    checkCode
      .mutateAsync({ code: appliedCode, subtotal: cart.subtotal })
      .then((r) => {
        if (!live) return
        if (r.ok) setApplied({ code: r.code, amount: r.amount })
        else {
          setApplied(null)
          setCodeMessage(r.message)
        }
      })
      .catch(() => live && setApplied(null))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.subtotal])

  async function onApplyCode() {
    setCodeMessage(null)
    const code = codeInput.trim()
    if (!code) return
    try {
      const r = await checkCode.mutateAsync({ code, subtotal: cart.subtotal })
      if (r.ok) {
        setApplied({ code: r.code, amount: r.amount })
        setCodeInput('')
      } else {
        setCodeMessage(r.message)
      }
    } catch {
      setCodeMessage("We couldn't check that code. Please try again.")
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const msisdn = normalizePhone(phone)
    if (name.trim().length < 2) return setFormError('Enter your name.')
    if (!msisdn) return setFormError('Enter a valid Safaricom number, e.g. 0712 345 678.')
    if (fulfilment === 'handover' && handoverNote.trim().length < 2) return setFormError('Tell us where you are staying so we can hand it over.')
    if (fulfilment === 'delivery' && address.trim().length < 5) return setFormError('Enter a delivery address.')

    try {
      const order = await place.mutateAsync({
        items: orderItems(cart.lines),
        fulfilment,
        name: name.trim(),
        phone: msisdn,
        handoverNote: handoverNote.trim(),
        address: address.trim(),
        discountCode: applied?.code,
        giftWrap: wrapping,
        giftMessage,
      })
      // The order now exists (and its stock is held), so the cart has done its job.
      cart.clear()
      try {
        await pay.mutateAsync({ orderId: order.id, phone: msisdn })
      } catch {
        // The order is saved; the guest can send the prompt again from My orders.
      }
      navigate('/my-orders', { state: { justPlaced: order.id } })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not place your order.')
    }
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16 text-center">
        <SEO title="Checkout" description="Your Nataka Holidays shop cart." noindex />
        <p className="text-charcoal-500">Your cart is empty.</p>
        <Link to="/shop" className="mt-4 inline-block rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800">
          Browse the shop
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <SEO title="Checkout" description="Your Nataka Holidays shop cart." noindex />
      <h1 className="font-display text-3xl font-medium text-teal-900">Checkout</h1>

      <ul className="mt-6 divide-y divide-sand-200 rounded-card bg-sand-50 shadow-card">
        {cart.lines.map((l) => (
          <li key={l.key} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-charcoal-900">{l.name}{l.variantName && <span className="font-normal text-charcoal-500"> · {l.variantName}</span>}</p>
              <p className="font-figures text-sm text-charcoal-500">{formatKES(l.price)} each</p>
            </div>
            <div className="flex items-center gap-2" role="group" aria-label={`Quantity of ${l.name}`}>
              <button type="button" aria-label="One fewer" onClick={() => cart.setQty(l.key, l.quantity - 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-sand-300 text-charcoal-700 hover:bg-sand-200">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center font-figures">{l.quantity}</span>
              <button type="button" aria-label="One more" disabled={l.quantity >= Math.min(l.maxQuantity, 20)} onClick={() => cart.setQty(l.key, l.quantity + 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-sand-300 text-charcoal-700 hover:bg-sand-200 disabled:opacity-40">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="w-24 text-right font-figures text-charcoal-900">{formatKES(l.price * l.quantity)}</p>
            <button type="button" aria-label={`Remove ${l.name}${l.variantName ? ` (${l.variantName})` : ''}`} onClick={() => cart.remove(l.key)} className="flex h-9 w-9 items-center justify-center rounded-full text-charcoal-500 hover:bg-coral-500/10 hover:text-coral-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <CartSuggestions />

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6" noValidate>
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-charcoal-700">How would you like to receive it?</legend>
          {([
            ['handover', 'Hand-over at my stay', 'We bring it to you during your stay. Free.'],
            ['delivery', 'Delivery', `We deliver it to you. Delivery fee ${formatKES(fee)}.`],
          ] as const).map(([value, title, hint]) => (
            <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-card border p-4 ${fulfilment === value ? 'border-teal-700 bg-teal-900/5' : 'border-sand-300'}`}>
              <input type="radio" name="fulfilment" value={value} checked={fulfilment === value} onChange={() => setFulfilment(value)} className="mt-1" />
              <span>
                <span className="block font-medium text-charcoal-900">{title}</span>
                <span className="block text-sm text-charcoal-500">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
            Your name
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
            M-Pesa number
            <input className={inputClass} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="0712 345 678" />
          </label>
        </div>

        {fulfilment === 'handover' ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
            Where are you staying?
            <input className={inputClass} value={handoverNote} onChange={(e) => setHandoverNote(e.target.value)} placeholder="Property name and dates, e.g. Beach Villa, 12–16 Nov" maxLength={300} />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
            Delivery address
            <textarea className={inputClass} rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Where should we deliver? Add a landmark if it helps." maxLength={500} />
          </label>
        )}

        {wrapFee > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-sand-300 p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-charcoal-700">
              <input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} />
              Gift wrap my order (+{formatKES(wrapFee)})
            </label>
            {giftWrap && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
                Gift message (optional)
                <textarea className={inputClass} rows={2} maxLength={200} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder="Happy birthday!" />
                <span className="text-xs font-normal text-charcoal-500">{giftMessage.length}/200</span>
              </label>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="discount-code" className="text-sm font-medium text-charcoal-700">Discount code</label>
          {applied ? (
            <p className="flex items-center justify-between rounded-lg bg-teal-900/10 px-4 py-2.5 text-sm text-teal-900">
              <span><strong>{applied.code}</strong> applied: {formatKES(applied.amount)} off</span>
              <button type="button" onClick={() => { setApplied(null); setCodeMessage(null) }} className="underline">Remove</button>
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                id="discount-code"
                className={inputClass}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onApplyCode() } }}
                placeholder="Have a code?"
                autoCapitalize="characters"
                maxLength={30}
              />
              <Button type="button" variant="secondary" loading={checkCode.isPending} disabled={!codeInput.trim()} onClick={() => void onApplyCode()}>Apply</Button>
            </div>
          )}
          {codeMessage && <p role="alert" className="text-sm text-coral-500">{codeMessage}</p>}
        </div>

        <dl className="rounded-card bg-sand-100 p-4 text-sm">
          <div className="flex justify-between py-1"><dt className="text-charcoal-500">Items</dt><dd className="font-figures">{formatKES(cart.subtotal)}</dd></div>
          {applied && <div className="flex justify-between py-1"><dt className="text-charcoal-500">Discount ({applied.code})</dt><dd className="font-figures">−{formatKES(applied.amount)}</dd></div>}
          {fulfilment === 'delivery' && <div className="flex justify-between py-1"><dt className="text-charcoal-500">Delivery</dt><dd className="font-figures">{formatKES(fee)}</dd></div>}
          {wrapping && <div className="flex justify-between py-1"><dt className="text-charcoal-500">Gift wrap</dt><dd className="font-figures">{formatKES(wrapFee)}</dd></div>}
          <div className="flex justify-between border-t border-sand-300 pt-2 text-base font-medium text-teal-900"><dt>Total</dt><dd className="font-figures">{formatKES(total)}</dd></div>
        </dl>

        {formError && <p role="alert" className="text-sm text-coral-500">{formError}</p>}

        <Button type="submit" loading={busy} className="w-full py-3 text-base sm:w-auto">
          Place order and pay with M-Pesa
        </Button>
        <p className="-mt-3 text-xs text-charcoal-500">
          We'll send a prompt to your phone. We hold your items for 30 minutes while you pay.
        </p>
      </form>
    </div>
  )
}

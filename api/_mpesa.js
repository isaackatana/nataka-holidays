// Pure helpers for the M-Pesa API routes. The leading underscore stops
// Vercel from exposing this file as an endpoint.

/** Normalises a Kenyan mobile number to 2547XXXXXXXX / 2541XXXXXXXX, or null. */
export function normalizeKenyanPhone(input) {
  const digits = String(input ?? '').replace(/\D/g, '')
  let full = null
  if (digits.startsWith('254') && digits.length === 12) full = digits
  else if (digits.startsWith('0') && digits.length === 10) full = `254${digits.slice(1)}`
  else if (digits.length === 9) full = `254${digits}`
  return full && /^254[17]\d{8}$/.test(full) ? full : null
}

/** Daraja timestamp (YYYYMMDDHHmmss) in East Africa Time. */
export function darajaTimestamp(date = new Date()) {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000)
  return eat.toISOString().replace(/\D/g, '').slice(0, 14)
}

export function darajaBaseUrl(env) {
  return env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'
}

/** Extracts what we need from Safaricom's STK callback body, or null if malformed. */
export function parseStkCallback(body) {
  const cb = body?.Body?.stkCallback
  if (!cb || typeof cb.CheckoutRequestID !== 'string') return null
  const items = cb.CallbackMetadata?.Item ?? []
  const pick = (name) => items.find((i) => i?.Name === name)?.Value
  const amount = pick('Amount')
  const receipt = pick('MpesaReceiptNumber')
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: Number(cb.ResultCode),
    resultDesc: typeof cb.ResultDesc === 'string' ? cb.ResultDesc : '',
    receipt: receipt == null ? null : String(receipt),
    amount: amount == null ? null : Math.round(Number(amount)),
  }
}

const SELF_PAY_COOLDOWN_MS = 3 * 60 * 1000

/**
 * Rules for a guest paying their own booking. Returns an error message,
 * or null if the payment may go ahead. `payments` are that booking's rows.
 */
export function selfPayError({ booking, userId, payments, amount, now = Date.now() }) {
  if (!userId || booking.customer_id !== userId) return 'This is not your booking.'
  if (booking.status !== 'confirmed') return 'You can pay once the booking is confirmed.'
  if (booking.estimated_total == null) return 'This booking has no total yet. Please contact us.'

  const paid = payments
    .filter((p) => p.status === 'success')
    .reduce((sum, p) => sum + (p.paid_amount ?? p.amount), 0)
  const balance = Number(booking.estimated_total) - paid
  if (balance <= 0) return 'This booking is already fully paid.'
  if (amount > balance) return `The most you can pay now is KSh ${Math.floor(balance).toLocaleString('en-KE')}.`

  const recentPending = payments.some(
    (p) => p.status === 'pending' && now - new Date(p.created_at).getTime() < SELF_PAY_COOLDOWN_MS,
  )
  if (recentPending) return 'A payment prompt was just sent. Check your phone, or try again in a few minutes.'

  return null
}

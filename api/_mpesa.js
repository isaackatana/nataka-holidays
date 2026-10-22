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

const ORDER_PAY_COOLDOWN_MS = 90 * 1000

/**
 * Rules for paying a shop order. Returns an error message, or null if a
 * prompt may be sent. The AMOUNT is never an input: it is always order.total.
 */
export function orderPayError({ order, userId, payments, now = Date.now() }) {
  if (!userId || order.customer_id !== userId) return 'This is not your order.'
  if (order.status === 'paid' || order.status === 'packed' || order.status === 'completed') {
    return 'This order is already paid.'
  }
  if (order.status !== 'pending_payment') return 'This order can no longer be paid. Please place it again.'
  if (new Date(order.expires_at).getTime() <= now) return 'This order has expired. Please place it again.'

  const recentPending = payments.some(
    (p) => p.status === 'pending' && now - new Date(p.created_at).getTime() < ORDER_PAY_COOLDOWN_MS,
  )
  if (recentPending) return 'A payment prompt was just sent. Check your phone, or try again in a minute.'
  return null
}

/**
 * Asks Safaricom to send an STK Push prompt. `cfg` holds the MPESA_* settings.
 * Returns { ok, stk, status }; throws if Safaricom cannot be reached or
 * rejects our credentials. Used by the shop endpoint (the booking endpoint
 * keeps its own copy so live booking payments are not touched).
 */
export async function requestStkPush({ cfg, amount, phone, reference, description, callbackUrl, fetchImpl = fetch }) {
  const base = darajaBaseUrl(cfg.MPESA_ENV)
  const basic = Buffer.from(`${cfg.MPESA_CONSUMER_KEY}:${cfg.MPESA_CONSUMER_SECRET}`).toString('base64')
  const tokenRes = await fetchImpl(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  })
  if (!tokenRes.ok) {
    const detail = (await tokenRes.text().catch(() => '')).slice(0, 300)
    console.error(`[mpesa] Daraja auth rejected: env=${cfg.MPESA_ENV || 'sandbox (default)'} status=${tokenRes.status} body=${detail}`)
    throw new Error(`Daraja auth failed (${tokenRes.status})`)
  }
  const { access_token: accessToken } = await tokenRes.json()

  const timestamp = darajaTimestamp()
  const password = Buffer.from(`${cfg.MPESA_SHORTCODE}${cfg.MPESA_PASSKEY}${timestamp}`).toString('base64')
  const stkRes = await fetchImpl(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: cfg.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: cfg.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: cfg.MPESA_PARTY_B || cfg.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: reference,
      TransactionDesc: description,
    }),
  })
  const stk = await stkRes.json().catch(() => ({}))
  return { ok: stkRes.ok && String(stk.ResponseCode) === '0', stk, status: stkRes.status }
}

const EXPERIENCE_PAY_COOLDOWN_MS = 90 * 1000

/** Plain-English reasons an experience can't be paid online yet (from experience_amount_due). */
const EXPERIENCE_REASONS = {
  not_found: 'This request was not found.',
  no_total: 'We have not set the final price yet. We will message you with it.',
  not_offered: 'Online payment is not available for this experience. We will share payment details when we confirm.',
  no_account: 'Online payment needs a request made while signed in. Please contact us.',
  not_confirmed: 'You can pay once we have confirmed your request.',
  paid: 'This request is already fully paid.',
}

/**
 * Rules for a guest paying an experience request. `due` is what the database
 * says is owed (experience_amount_due); the AMOUNT is never an input, it is
 * always due.due_now. Returns an error message, or null if a prompt may go out.
 */
export function experiencePayError({ due, payments, now = Date.now() }) {
  if (!due || due.payable !== true) {
    return EXPERIENCE_REASONS[due?.reason] ?? 'This request can not be paid online right now.'
  }
  if (!Number.isInteger(due.due_now) || due.due_now < 1) return 'Nothing is due on this request.'

  const recentPending = (payments ?? []).some(
    (p) => p.status === 'pending' && now - new Date(p.created_at).getTime() < EXPERIENCE_PAY_COOLDOWN_MS,
  )
  if (recentPending) return 'A payment prompt was just sent. Check your phone, or try again in a minute.'
  return null
}

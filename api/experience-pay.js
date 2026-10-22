// POST /api/experience-pay  — the signed-in guest who made the request.
// Body: { requestId, phone }
//
// Sends an M-Pesa prompt for an experience request: the deposit first, then
// the balance. The AMOUNT is never taken from the request: it is what the
// database says is due now (experience_amount_due), and the database works it
// out again when the prompt is saved. The result arrives at /api/pay-callback
// like booking and shop payments do.
//
// Runs with the caller's Supabase session (their JWT is forwarded), so
// row-level security means a guest can only ever see their own request.
import { createClient } from '@supabase/supabase-js'
import { experiencePayError, normalizeKenyanPhone, requestStkPush } from './_mpesa.js'

const SITE_URL = process.env.SITE_URL || 'https://natakaholidays.co.ke'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(res, status, error) {
  res.status(status).json({ error })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed')

  const cfg = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, typeof v === 'string' ? v.trim().replace(/^["']|["']$/g, '') : v]),
  )
  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, MPESA_CALLBACK_SECRET } = cfg
  if (
    !VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY || !MPESA_CALLBACK_SECRET ||
    !cfg.MPESA_CONSUMER_KEY || !cfg.MPESA_CONSUMER_SECRET || !cfg.MPESA_SHORTCODE || !cfg.MPESA_PASSKEY
  ) {
    console.error('[experience-pay] Missing M-Pesa / Supabase environment variables')
    return fail(res, 500, 'Payments are not configured yet.')
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return fail(res, 401, 'Please sign in again.')

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return fail(res, 401, 'Please sign in again.')

  const { requestId, phone } = req.body ?? {}
  const msisdn = normalizeKenyanPhone(phone)
  if (typeof requestId !== 'string' || !UUID_RE.test(requestId)) return fail(res, 400, 'Invalid request.')
  if (!msisdn) return fail(res, 400, 'Enter a valid Safaricom number, e.g. 0712 345 678.')

  // What is owed, decided by the database (and only visible to the request's owner).
  const { data: due, error: dueError } = await supabase.rpc('experience_amount_due', { p_request_id: requestId })
  if (dueError) {
    console.error('[experience-pay] experience_amount_due failed:', dueError.message)
    return fail(res, 500, 'Could not check what is due. Please try again.')
  }

  const { data: existing } = await supabase
    .from('experience_payments')
    .select('status, created_at')
    .eq('request_id', requestId)
  const problem = experiencePayError({ due, payments: existing ?? [] })
  if (problem) return fail(res, 400, problem)

  try {
    const { ok, stk, status } = await requestStkPush({
      cfg,
      amount: due.due_now,
      phone: msisdn,
      reference: `NATAKA-EXP-${requestId.slice(0, 6).toUpperCase()}`,
      description: due.phase === 'deposit' ? 'Experience deposit' : 'Experience payment',
      callbackUrl: `${SITE_URL}/api/pay-callback?s=${encodeURIComponent(MPESA_CALLBACK_SECRET)}`,
    })
    if (!ok) {
      console.error('[experience-pay] STK push rejected:', status, stk)
      return fail(res, 502, stk.CustomerMessage || stk.errorMessage || 'Safaricom did not accept the request.')
    }

    const { data: payment, error: insertError } = await supabase.rpc('record_experience_payment_request', {
      p_secret: MPESA_CALLBACK_SECRET,
      p_request_id: requestId,
      p_phone: msisdn,
      p_checkout_request_id: stk.CheckoutRequestID,
      p_merchant_request_id: stk.MerchantRequestID ?? null,
    })
    if (insertError) {
      // The guest has been prompted but the row couldn't be saved. Log the id
      // loudly so the payment can still be matched by hand.
      console.error('[experience-pay] STK sent but payment row NOT saved:', stk.CheckoutRequestID, insertError)
      return fail(res, 500, 'Prompt sent, but saving the payment failed. Please contact us if you were charged.')
    }
    return res.status(200).json({ payment: { id: payment.id, status: payment.status, amount: payment.amount } })
  } catch (err) {
    console.error('[experience-pay] Unexpected failure:', err)
    return fail(res, 502, 'Could not reach M-Pesa. Please try again.')
  }
}

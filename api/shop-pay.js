// POST /api/shop-pay  — the signed-in customer who placed the order.
// Body: { orderId, phone }
//
// Sends an M-Pesa prompt for a shop order. The AMOUNT is always the order's
// own total read from the database, never taken from the request. The
// result arrives at /api/pay-callback like booking payments do.
//
// Runs with the caller's Supabase session (their JWT is forwarded), so
// row-level security means a customer can only ever see their own order.
import { createClient } from '@supabase/supabase-js'
import { normalizeKenyanPhone, orderPayError, requestStkPush } from './_mpesa.js'

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
    console.error('[shop-pay] Missing M-Pesa / Supabase environment variables')
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

  const { orderId, phone } = req.body ?? {}
  const msisdn = normalizeKenyanPhone(phone)
  if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) return fail(res, 400, 'Invalid order.')
  if (!msisdn) return fail(res, 400, 'Enter a valid Safaricom number, e.g. 0712 345 678.')

  // RLS: only the owner (or an admin) can see the order at all.
  const { data: order } = await supabase
    .from('orders')
    .select('id, customer_id, status, total, expires_at')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return fail(res, 404, 'Order not found.')

  const { data: existing } = await supabase
    .from('order_payments')
    .select('status, created_at')
    .eq('order_id', orderId)
  const problem = orderPayError({ order, userId: userData.user.id, payments: existing ?? [] })
  if (problem) return fail(res, 400, problem)

  try {
    const { ok, stk, status } = await requestStkPush({
      cfg,
      amount: Number(order.total),
      phone: msisdn,
      reference: `NATAKA-SHOP-${orderId.slice(0, 6).toUpperCase()}`,
      description: 'Shop order',
      callbackUrl: `${SITE_URL}/api/pay-callback?s=${encodeURIComponent(MPESA_CALLBACK_SECRET)}`,
    })
    if (!ok) {
      console.error('[shop-pay] STK push rejected:', status, stk)
      return fail(res, 502, stk.CustomerMessage || stk.errorMessage || 'Safaricom did not accept the request.')
    }

    const { data: payment, error: insertError } = await supabase.rpc('record_order_payment_request', {
      p_secret: MPESA_CALLBACK_SECRET,
      p_order_id: orderId,
      p_phone: msisdn,
      p_checkout_request_id: stk.CheckoutRequestID,
      p_merchant_request_id: stk.MerchantRequestID ?? null,
    })
    if (insertError) {
      console.error('[shop-pay] STK sent but payment row NOT saved:', stk.CheckoutRequestID, insertError)
      return fail(res, 500, 'Prompt sent, but saving the payment failed. Please contact us if you were charged.')
    }
    return res.status(200).json({ payment: { id: payment.id, status: payment.status } })
  } catch (err) {
    console.error('[shop-pay] Unexpected failure:', err)
    return fail(res, 502, 'Could not reach M-Pesa. Please try again.')
  }
}

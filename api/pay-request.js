// POST /api/pay-request  — signed-in admin OR the booking's own customer.
// Body: { bookingId, amount, phone }
//
// Sends an M-Pesa STK Push prompt to the given phone and records a
// 'pending' payment row. The result arrives later at /api/pay-callback.
//
// Runs with the CALLER'S Supabase session (their JWT is forwarded), so
// row-level security decides what they can see. Admins may request any
// amount on any non-cancelled booking and insert via RLS. Customers may
// only pay their own CONFIRMED booking, up to the unpaid balance (see
// selfPayError), and their row is recorded through a secret-guarded
// database function since customers have no insert permission. No
// service_role key is used.
//
// (Endpoint names deliberately avoid the word "mpesa": Safaricom has been
// known to reject callback URLs containing brand keywords.)
import { createClient } from '@supabase/supabase-js'
import { darajaBaseUrl, darajaTimestamp, normalizeKenyanPhone, selfPayError } from './_mpesa.js'

const SITE_URL = process.env.SITE_URL || 'https://natakaholidays.co.ke'
const MAX_AMOUNT = 250000 // M-Pesa's per-transaction limit
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(res, status, error) {
  res.status(status).json({ error })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed')

  const {
    VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY,
    MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET,
    MPESA_SHORTCODE,
    MPESA_PASSKEY,
    MPESA_CALLBACK_SECRET,
    MPESA_ENV,
    MPESA_TRANSACTION_TYPE,
    MPESA_PARTY_B,
  } = process.env

  if (
    !VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY || !MPESA_CONSUMER_KEY ||
    !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY || !MPESA_CALLBACK_SECRET
  ) {
    console.error('[pay-request] Missing M-Pesa / Supabase environment variables')
    return fail(res, 500, 'Payments are not configured yet.')
  }

  // ---- 1. Who is calling? Must be signed in (admin or customer). ----
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return fail(res, 401, 'Please sign in again.')

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return fail(res, 401, 'Please sign in again.')
  const userId = userData.user.id

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin')
  if (adminError) return fail(res, 500, 'Could not verify your account.')

  // ---- 2. Validate input. ----
  const { bookingId, amount, phone } = req.body ?? {}
  const amountInt = Number(amount)
  const msisdn = normalizeKenyanPhone(phone)

  if (typeof bookingId !== 'string' || !UUID_RE.test(bookingId)) return fail(res, 400, 'Invalid booking.')
  if (!Number.isInteger(amountInt) || amountInt < 1 || amountInt > MAX_AMOUNT) {
    return fail(res, 400, `Amount must be a whole number from 1 to ${MAX_AMOUNT.toLocaleString('en-KE')}.`)
  }
  if (!msisdn) return fail(res, 400, 'Enter a valid Safaricom number, e.g. 0712 345 678.')

  // RLS: a customer can only see their own booking; an admin sees all.
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, customer_id, estimated_total')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return fail(res, 404, 'Booking not found.')

  if (isAdmin === true) {
    if (booking.status === 'cancelled') return fail(res, 400, 'This booking is cancelled.')
  } else {
    const { data: existing } = await supabase
      .from('payments')
      .select('status, amount, paid_amount, created_at')
      .eq('booking_id', bookingId)
    const problem = selfPayError({ booking, userId, payments: existing ?? [], amount: amountInt })
    if (problem) return fail(res, 400, problem)
  }

  // ---- 3. Ask Safaricom to prompt the guest. ----
  const base = darajaBaseUrl(MPESA_ENV)
  try {
    const basic = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64')
    const tokenRes = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${basic}` },
    })
    if (!tokenRes.ok) throw new Error(`Daraja auth failed (${tokenRes.status})`)
    const { access_token: accessToken } = await tokenRes.json()

    const timestamp = darajaTimestamp()
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64')

    const stkRes = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
        Amount: amountInt,
        PartyA: msisdn,
        PartyB: MPESA_PARTY_B || MPESA_SHORTCODE,
        PhoneNumber: msisdn,
        CallBackURL: `${SITE_URL}/api/pay-callback?s=${encodeURIComponent(MPESA_CALLBACK_SECRET)}`,
        AccountReference: `NATAKA-${bookingId.slice(0, 8).toUpperCase()}`,
        TransactionDesc: 'Booking payment',
      }),
    })
    const stk = await stkRes.json().catch(() => ({}))

    if (!stkRes.ok || String(stk.ResponseCode) !== '0') {
      console.error('[pay-request] STK push rejected:', stkRes.status, stk)
      return fail(res, 502, stk.CustomerMessage || stk.errorMessage || 'Safaricom did not accept the request.')
    }

    // ---- 4. Record it as pending. ----
    const row = {
      booking_id: bookingId,
      amount: amountInt,
      phone: msisdn,
      checkout_request_id: stk.CheckoutRequestID,
      merchant_request_id: stk.MerchantRequestID ?? null,
    }
    const { data: payment, error: insertError } =
      isAdmin === true
        ? await supabase.from('payments').insert(row).select('*').single() // RLS: admin-only
        : await supabase.rpc('record_mpesa_request', {
            p_secret: MPESA_CALLBACK_SECRET,
            p_booking_id: bookingId,
            p_amount: amountInt,
            p_phone: msisdn,
            p_checkout_request_id: row.checkout_request_id,
            p_merchant_request_id: row.merchant_request_id,
          })

    if (insertError) {
      // The guest has been prompted but we couldn't save the row. Log the
      // id loudly so the payment can still be matched by hand.
      console.error('[pay-request] STK sent but payment row NOT saved:', stk.CheckoutRequestID, insertError)
      return fail(res, 500, 'Prompt sent, but saving the payment failed. Please contact us if you were charged.')
    }

    return res.status(200).json({ payment })
  } catch (err) {
    console.error('[pay-request] Unexpected failure:', err)
    return fail(res, 502, 'Could not reach M-Pesa. Please try again.')
  }
}

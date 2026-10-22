// POST /api/pay-callback?s=<secret>  — called by Safaricom, not by the app.
//
// Hands the STK result to the record_mpesa_result() database function,
// which only acts if `s` matches the secret stored in app_secrets.
// Always answers 200 so Safaricom doesn't keep retrying; problems are
// logged instead.
import { createClient } from '@supabase/supabase-js'
import { parseStkCallback } from './_mpesa.js'
import { sendBookingNotification, sendExperiencePaymentNotification, sendOrderNotification } from './_notify.js'

const ACK = { ResultCode: 0, ResultDesc: 'Accepted' }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const parsed = parseStkCallback(req.body)
  const secret = typeof req.query.s === 'string' ? req.query.s : ''
  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env

  if (!parsed) {
    console.warn('[pay-callback] Ignoring malformed callback body')
    return res.status(200).json(ACK)
  }
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    console.error('[pay-callback] Supabase env vars missing; result NOT recorded:', parsed.checkoutRequestId)
    return res.status(200).json(ACK)
  }

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: resolved, error } = await supabase.rpc('record_mpesa_result', {
    p_secret: secret,
    p_checkout_request_id: parsed.checkoutRequestId,
    p_result_code: parsed.resultCode,
    p_result_desc: parsed.resultDesc,
    p_receipt: parsed.receipt,
    p_paid_amount: parsed.amount,
  })
  if (error) console.error('[pay-callback] Could not record result:', parsed.checkoutRequestId, error.message)

  // Email a receipt for a payment that was just resolved as successful.
  // resolved.id is null when nothing changed (replayed callback), so a
  // repeat from Safaricom never sends a second receipt.
  if (!error && resolved?.id && resolved.status === 'success') {
    try {
      await sendBookingNotification({
        event: 'payment',
        bookingId: resolved.booking_id,
        payment: { id: resolved.id, amount: resolved.paid_amount ?? resolved.amount, receipt: resolved.mpesa_receipt },
      })
    } catch (err) {
      console.error('[pay-callback] receipt email failed:', err)
    }
  }

  // Not a booking payment? Then it may be for a shop order, and if not that,
  // an experience payment. (A replayed callback lands here too and simply
  // finds nothing left to change.)
  let handledAsOrder = false
  if (!error && !resolved?.id) {
    const { data: order, error: orderError } = await supabase.rpc('record_order_payment_result', {
      p_secret: secret,
      p_checkout_request_id: parsed.checkoutRequestId,
      p_result_code: parsed.resultCode,
      p_result_desc: parsed.resultDesc,
      p_receipt: parsed.receipt,
      p_paid_amount: parsed.amount,
    })
    if (orderError) console.error('[pay-callback] Could not record order result:', parsed.checkoutRequestId, orderError.message)

    handledAsOrder = Boolean(order?.id)
    if (!orderError && order?.id && order.status === 'success') {
      try {
        await sendOrderNotification({ orderId: order.order_id, receipt: order.mpesa_receipt })
      } catch (err) {
        console.error('[pay-callback] order email failed:', err)
      }
    }
  }

  // Experience payment? Only tried when it was neither a booking nor an order.
  if (!error && !resolved?.id && !handledAsOrder) {
    const { data: experiencePayment, error: experienceError } = await supabase.rpc('record_experience_payment_result', {
      p_secret: secret,
      p_checkout_request_id: parsed.checkoutRequestId,
      p_result_code: parsed.resultCode,
      p_result_desc: parsed.resultDesc,
      p_receipt: parsed.receipt,
      p_paid_amount: parsed.amount,
    })
    // Before migration 0027 this function doesn't exist; that just means nothing to do.
    if (experienceError && experienceError.code !== 'PGRST202' && experienceError.code !== '42883') {
      console.error('[pay-callback] Could not record experience result:', parsed.checkoutRequestId, experienceError.message)
    }

    if (!experienceError && experiencePayment?.id && experiencePayment.status === 'success') {
      try {
        await sendExperiencePaymentNotification({ paymentId: experiencePayment.id })
      } catch (err) {
        console.error('[pay-callback] experience payment email failed:', err)
      }
    }
  }

  return res.status(200).json(ACK)
}

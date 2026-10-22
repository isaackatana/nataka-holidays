// Sends booking emails via Resend. Shared by api/notify.js (guest enquiry,
// admin confirm/cancel) and api/pay-callback.js (payment receipts).
// Email is optional: with no RESEND_API_KEY it quietly does nothing, so
// the rest of the site works without it.
import { createClient } from '@supabase/supabase-js'
import {
  buildEmails, buildExperiencePaymentEmails, buildExperienceRequestEmails, buildOrderEmails, eventAllowed,
} from './_emails.js'

const SITE_URL = process.env.SITE_URL || 'https://natakaholidays.co.ke'

async function sendViaResend({ apiKey, from, to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/**
 * @param event 'enquiry' | 'confirmed' | 'cancelled' | 'payment' | 'reminder' | 'review_request' | 'review_submitted'
 * @param payment  for 'payment': { id, amount, receipt }
 * @returns { sent: boolean, reason?: string }
 */
export async function sendBookingNotification({ event, bookingId, payment }) {
  const {
    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, MPESA_CALLBACK_SECRET,
    RESEND_API_KEY, NOTIFY_FROM_EMAIL, NOTIFY_ADMIN_EMAIL,
  } = process.env

  if (!RESEND_API_KEY || !NOTIFY_FROM_EMAIL) return { sent: false, reason: 'email_not_configured' }
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY || !MPESA_CALLBACK_SECRET) {
    console.error('[notify] Supabase / secret env vars missing')
    return { sent: false, reason: 'not_configured' }
  }

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: ctx, error } = await supabase.rpc('notification_context', {
    p_secret: MPESA_CALLBACK_SECRET,
    p_booking_id: bookingId,
  })
  if (error) {
    console.error('[notify] notification_context failed:', error.message)
    return { sent: false, reason: 'lookup_failed' }
  }
  if (!ctx) return { sent: false, reason: 'not_found' }

  const eventKey = event === 'payment' ? `payment:${payment?.id}` : event
  if ((ctx.sent_events ?? []).includes(eventKey)) return { sent: false, reason: 'already_sent' }
  if (!eventAllowed(event, ctx.booking)) return { sent: false, reason: 'not_allowed' }
  if (event === 'review_submitted' && !ctx.review) return { sent: false, reason: 'not_allowed' }

  const emails = buildEmails(event, ctx, {
    siteUrl: SITE_URL,
    extra: payment ? { amount: payment.amount, receipt: payment.receipt } : undefined,
  })

  let guestSent = false
  let adminSent = false
  for (const mail of emails) {
    const to = mail.to === 'guest' ? ctx.booking.guest_email : NOTIFY_ADMIN_EMAIL
    if (!to) continue
    try {
      await sendViaResend({ apiKey: RESEND_API_KEY, from: NOTIFY_FROM_EMAIL, to, subject: mail.subject, html: mail.html, text: mail.text })
      if (mail.to === 'guest') guestSent = true
      else adminSent = true
    } catch (err) {
      console.error(`[notify] ${event} email to ${mail.to} failed:`, err.message)
    }
  }

  // Mark as done once the guest has their email, so a retry can't double-send.
  // (Admin copies of guest emails are best effort.) An event that only ever
  // goes to the business (a new review) is marked once that email is sent.
  const adminOnly = emails.length > 0 && emails.every((m) => m.to === 'admin')
  const delivered = adminOnly ? adminSent : guestSent
  if (delivered) {
    const { error: markError } = await supabase.rpc('mark_notification_sent', {
      p_secret: MPESA_CALLBACK_SECRET,
      p_booking_id: bookingId,
      p_event: eventKey,
    })
    if (markError) console.error('[notify] could not mark sent:', markError.message)
  }
  return { sent: delivered, reason: delivered ? undefined : 'send_failed' }
}

/**
 * Receipt + admin alert for a shop order that has just been paid. Called only
 * from the verified M-Pesa callback, right after the payment is first
 * recorded, so it fires once per payment.
 */
export async function sendOrderNotification({ orderId, receipt }) {
  const {
    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, MPESA_CALLBACK_SECRET,
    RESEND_API_KEY, NOTIFY_FROM_EMAIL, NOTIFY_ADMIN_EMAIL,
  } = process.env

  if (!RESEND_API_KEY || !NOTIFY_FROM_EMAIL) return { sent: false, reason: 'email_not_configured' }
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY || !MPESA_CALLBACK_SECRET) {
    console.error('[notify] Supabase / secret env vars missing')
    return { sent: false, reason: 'not_configured' }
  }

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: ctx, error } = await supabase.rpc('order_notification_context', {
    p_secret: MPESA_CALLBACK_SECRET,
    p_order_id: orderId,
  })
  if (error || !ctx) {
    console.error('[notify] order_notification_context failed:', error?.message ?? 'not found')
    return { sent: false, reason: 'lookup_failed' }
  }
  // Only ever email about an order that really is paid (or further along).
  if (!['paid', 'packed', 'completed'].includes(ctx.order.status)) return { sent: false, reason: 'not_paid' }

  let guestSent = false
  for (const mail of buildOrderEmails(ctx, { siteUrl: SITE_URL, receipt })) {
    const to = mail.to === 'guest' ? ctx.order.customer_email : NOTIFY_ADMIN_EMAIL
    if (!to) continue
    try {
      await sendViaResend({ apiKey: RESEND_API_KEY, from: NOTIFY_FROM_EMAIL, to, subject: mail.subject, html: mail.html, text: mail.text })
      if (mail.to === 'guest') guestSent = true
    } catch (err) {
      console.error(`[notify] order email to ${mail.to} failed:`, err.message)
    }
  }
  return { sent: guestSent }
}

/**
 * Confirmation to the guest and an alert to the business for a new experience
 * request. The database hands out the "send" permission to exactly one caller
 * (claim_experience_request_notification), so repeated or simultaneous calls
 * can never email twice. If nothing could be sent, the claim is released so a
 * later attempt can try again.
 */
export async function sendExperienceRequestNotification({ requestId }) {
  const {
    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, MPESA_CALLBACK_SECRET,
    RESEND_API_KEY, NOTIFY_FROM_EMAIL, NOTIFY_ADMIN_EMAIL,
  } = process.env

  if (!RESEND_API_KEY || !NOTIFY_FROM_EMAIL) return { sent: false, reason: 'email_not_configured' }
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY || !MPESA_CALLBACK_SECRET) {
    console.error('[notify] Supabase / secret env vars missing')
    return { sent: false, reason: 'not_configured' }
  }

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: ctx, error } = await supabase.rpc('experience_request_context', {
    p_secret: MPESA_CALLBACK_SECRET,
    p_request_id: requestId,
  })
  if (error) {
    console.error('[notify] experience_request_context failed:', error.message)
    return { sent: false, reason: 'lookup_failed' }
  }
  if (!ctx) return { sent: false, reason: 'not_found' }
  if (ctx.request.notified) return { sent: false, reason: 'already_sent' }
  if (ctx.request.status !== 'new') return { sent: false, reason: 'not_allowed' }

  const { data: claimed, error: claimError } = await supabase.rpc('claim_experience_request_notification', {
    p_secret: MPESA_CALLBACK_SECRET,
    p_request_id: requestId,
  })
  if (claimError) {
    console.error('[notify] claim failed:', claimError.message)
    return { sent: false, reason: 'lookup_failed' }
  }
  if (!claimed) return { sent: false, reason: 'already_sent' }

  let anySent = false
  for (const mail of buildExperienceRequestEmails(ctx, { siteUrl: SITE_URL })) {
    const to = mail.to === 'guest' ? ctx.request.guest_email : NOTIFY_ADMIN_EMAIL
    if (!to) continue
    try {
      await sendViaResend({ apiKey: RESEND_API_KEY, from: NOTIFY_FROM_EMAIL, to, subject: mail.subject, html: mail.html, text: mail.text })
      anySent = true
    } catch (err) {
      console.error(`[notify] experience request email to ${mail.to} failed:`, err.message)
    }
  }

  if (!anySent) {
    await supabase.rpc('release_experience_request_notification', {
      p_secret: MPESA_CALLBACK_SECRET,
      p_request_id: requestId,
    })
    return { sent: false, reason: 'send_failed' }
  }
  return { sent: true }
}

/**
 * Receipt to the guest and an alert to the business for a successful experience
 * payment. Called once by the callback, when the payment was just resolved
 * (a replayed callback finds nothing left to resolve), so it never double-sends.
 */
export async function sendExperiencePaymentNotification({ paymentId }) {
  const {
    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, MPESA_CALLBACK_SECRET,
    RESEND_API_KEY, NOTIFY_FROM_EMAIL, NOTIFY_ADMIN_EMAIL,
  } = process.env

  if (!RESEND_API_KEY || !NOTIFY_FROM_EMAIL) return { sent: false, reason: 'email_not_configured' }
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY || !MPESA_CALLBACK_SECRET) {
    console.error('[notify] Supabase / secret env vars missing')
    return { sent: false, reason: 'not_configured' }
  }

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: ctx, error } = await supabase.rpc('experience_payment_context', {
    p_secret: MPESA_CALLBACK_SECRET,
    p_payment_id: paymentId,
  })
  if (error) {
    console.error('[notify] experience_payment_context failed:', error.message)
    return { sent: false, reason: 'lookup_failed' }
  }
  if (!ctx) return { sent: false, reason: 'not_found' }

  let anySent = false
  for (const mail of buildExperiencePaymentEmails(ctx, { siteUrl: SITE_URL })) {
    const to = mail.to === 'guest' ? ctx.request.guest_email : NOTIFY_ADMIN_EMAIL
    if (!to) continue
    try {
      await sendViaResend({ apiKey: RESEND_API_KEY, from: NOTIFY_FROM_EMAIL, to, subject: mail.subject, html: mail.html, text: mail.text })
      anySent = true
    } catch (err) {
      console.error(`[notify] experience payment email to ${mail.to} failed:`, err.message)
    }
  }
  return { sent: anySent, reason: anySent ? undefined : 'send_failed' }
}

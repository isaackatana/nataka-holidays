// Sends booking emails via Resend. Shared by api/notify.js (guest enquiry,
// admin confirm/cancel) and api/pay-callback.js (payment receipts).
// Email is optional: with no RESEND_API_KEY it quietly does nothing, so
// the rest of the site works without it.
import { createClient } from '@supabase/supabase-js'
import { buildEmails, eventAllowed } from './_emails.js'

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
 * @param event 'enquiry' | 'confirmed' | 'cancelled' | 'payment' | 'reminder'
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

  const emails = buildEmails(event, ctx, {
    siteUrl: SITE_URL,
    extra: payment ? { amount: payment.amount, receipt: payment.receipt } : undefined,
  })

  let guestSent = false
  for (const mail of emails) {
    const to = mail.to === 'guest' ? ctx.booking.guest_email : NOTIFY_ADMIN_EMAIL
    if (!to) continue
    try {
      await sendViaResend({ apiKey: RESEND_API_KEY, from: NOTIFY_FROM_EMAIL, to, subject: mail.subject, html: mail.html, text: mail.text })
      if (mail.to === 'guest') guestSent = true
    } catch (err) {
      console.error(`[notify] ${event} email to ${mail.to} failed:`, err.message)
    }
  }

  // Mark as done once the guest has their email, so a retry can't double-send.
  // (Admin-only copies are best effort.)
  if (guestSent) {
    const { error: markError } = await supabase.rpc('mark_notification_sent', {
      p_secret: MPESA_CALLBACK_SECRET,
      p_booking_id: bookingId,
      p_event: eventKey,
    })
    if (markError) console.error('[notify] could not mark sent:', markError.message)
  }
  return { sent: guestSent, reason: guestSent ? undefined : 'send_failed' }
}

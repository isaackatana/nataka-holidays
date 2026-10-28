// GET /api/send-reminders — run daily by Vercel Cron (see vercel.json).
//
// Emails arrival details to guests whose CONFIRMED booking starts within
// the next few days and who haven't had a reminder yet. Looking a few days
// ahead (not exactly N days) means a missed run, or a booking confirmed at
// the last minute, is still picked up. Each booking gets one reminder.
//
// The same run also e-mails the business when shop items are running low (only when the
// list of low items has changed since the last e-mail).
//
// The same run also sends each guest ONE "how was your stay?" email after a
// COMPLETED stay (ended within the last two weeks, signed-in guests only,
// no review written yet).
//
// Protected by CRON_SECRET: Vercel sends it as a Bearer token on cron
// invocations when that environment variable exists. With no CRON_SECRET
// configured the endpoint refuses to run rather than being open to anyone.
import { createClient } from '@supabase/supabase-js'
import { reminderWindow, reviewRequestWindow } from './_emails.js'
import { sendBackInStockEmails, sendBookingNotification, sendLowStockDigest } from './_notify.js'

const MAX_PER_RUN = 20 // stays inside the function time limit; leftovers go out next run
const PAUSE_MS = 500 // email providers rate-limit bursts

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function sendBatch({ supabase, lookup, event, window, max = MAX_PER_RUN }) {
  const { data: ids, error } = await supabase.rpc(lookup, {
    p_secret: process.env.MPESA_CALLBACK_SECRET,
    p_from: window.from,
    p_to: window.to,
  })
  if (error) {
    console.error(`[send-reminders] ${lookup} failed:`, error.message)
    return { error: true, due: 0, sent: 0, skipped: 0, failed: 0 }
  }

  const due = ids ?? []
  const tally = { error: false, due: due.length, sent: 0, skipped: 0, failed: 0 }

  for (const bookingId of due.slice(0, max)) {
    try {
      const result = await sendBookingNotification({ event, bookingId })
      if (result.sent) tally.sent += 1
      else if (result.reason === 'send_failed' || result.reason === 'lookup_failed') tally.failed += 1
      else tally.skipped += 1
      if (result.reason === 'email_not_configured') break // nothing will send; stop early
    } catch (err) {
      console.error(`[send-reminders] unexpected ${event} failure for`, bookingId, err)
      tally.failed += 1
    }
    await sleep(PAUSE_MS)
  }
  return tally
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const { CRON_SECRET, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, MPESA_CALLBACK_SECRET } = process.env
  if (!CRON_SECRET) return res.status(500).json({ error: 'CRON_SECRET is not configured.' })
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' })
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY || !MPESA_CALLBACK_SECRET) {
    return res.status(500).json({ error: 'Supabase is not configured.' })
  }

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const reminders = await sendBatch({
    supabase,
    lookup: 'bookings_due_reminder',
    event: 'reminder',
    window: reminderWindow(),
  })
  if (reminders.error) return res.status(500).json({ error: 'Lookup failed.' })

  // Review requests are best effort: a failed lookup (e.g. migration 0019 not
  // run yet) must not hide the reminder results above.
  const reviews = await sendBatch({
    supabase,
    lookup: 'bookings_due_review_request',
    event: 'review_request',
    window: reviewRequestWindow(),
    max: 10, // keeps the whole run inside the function time limit
  })

  // Low stock is best effort too (a failure here must not hide the results above).
  let lowStock
  try {
    lowStock = await sendLowStockDigest()
  } catch (err) {
    console.error('[send-reminders] low-stock digest failed:', err)
    lowStock = { sent: false, reason: 'error' }
  }

  // Guests waiting for a sold-out item to return (best effort as well).
  let backInStock
  try {
    backInStock = await sendBackInStockEmails()
  } catch (err) {
    console.error('[send-reminders] back-in-stock emails failed:', err)
    backInStock = { sent: 0, failed: 0, reason: 'error' }
  }

  const tally = {
    due: reminders.due, sent: reminders.sent, skipped: reminders.skipped, failed: reminders.failed,
    reviewRequests: reviews.error
      ? { error: true }
      : { due: reviews.due, sent: reviews.sent, skipped: reviews.skipped, failed: reviews.failed },
    lowStock,
    backInStock,
  }

  console.log('[send-reminders]', JSON.stringify(tally))
  return res.status(200).json(tally)
}

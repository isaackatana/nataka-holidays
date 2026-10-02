// GET /api/send-reminders — run daily by Vercel Cron (see vercel.json).
//
// Emails arrival details to guests whose CONFIRMED booking starts within
// the next few days and who haven't had a reminder yet. Looking a few days
// ahead (not exactly N days) means a missed run, or a booking confirmed at
// the last minute, is still picked up. Each booking gets one reminder.
//
// Protected by CRON_SECRET: Vercel sends it as a Bearer token on cron
// invocations when that environment variable exists. With no CRON_SECRET
// configured the endpoint refuses to run rather than being open to anyone.
import { createClient } from '@supabase/supabase-js'
import { reminderWindow } from './_emails.js'
import { sendBookingNotification } from './_notify.js'

const MAX_PER_RUN = 20 // stays inside the function time limit; leftovers go out next run
const PAUSE_MS = 500 // email providers rate-limit bursts

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

  const { from, to } = reminderWindow()
  const { data: ids, error } = await supabase.rpc('bookings_due_reminder', {
    p_secret: MPESA_CALLBACK_SECRET,
    p_from: from,
    p_to: to,
  })
  if (error) {
    console.error('[send-reminders] lookup failed:', error.message)
    return res.status(500).json({ error: 'Lookup failed.' })
  }

  const due = ids ?? []
  const batch = due.slice(0, MAX_PER_RUN)
  const tally = { due: due.length, sent: 0, skipped: 0, failed: 0 }

  for (const bookingId of batch) {
    try {
      const result = await sendBookingNotification({ event: 'reminder', bookingId })
      if (result.sent) tally.sent += 1
      else if (result.reason === 'send_failed' || result.reason === 'lookup_failed') tally.failed += 1
      else tally.skipped += 1
      if (result.reason === 'email_not_configured') break // nothing will send; stop early
    } catch (err) {
      console.error('[send-reminders] unexpected failure for', bookingId, err)
      tally.failed += 1
    }
    await sleep(PAUSE_MS)
  }

  console.log('[send-reminders]', JSON.stringify({ window: { from, to }, ...tally }))
  return res.status(200).json(tally)
}

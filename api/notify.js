// POST /api/notify  { event: 'enquiry' | 'confirmed' | 'cancelled', bookingId }
//
// Public on purpose (a guest enquiry has no account), and safe because:
// the recipient always comes from the booking row, never the request; the
// email only sends if the booking is currently in the matching state; and
// each event sends once per booking. 'payment' receipts are NOT accepted
// here — they're sent only from the verified M-Pesa callback.
import { sendBookingNotification } from './_notify.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EVENTS = new Set(['enquiry', 'confirmed', 'cancelled'])

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { event, bookingId } = req.body ?? {}
  if (!EVENTS.has(event) || typeof bookingId !== 'string' || !UUID_RE.test(bookingId)) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  try {
    const result = await sendBookingNotification({ event, bookingId })
    return res.status(200).json(result)
  } catch (err) {
    console.error('[notify] unexpected failure:', err)
    return res.status(200).json({ sent: false, reason: 'error' })
  }
}

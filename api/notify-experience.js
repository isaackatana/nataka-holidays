// POST /api/notify-experience  { requestId }
//
// Public on purpose (an experience request needs no account), and safe because:
// the recipients come from the stored request, never from this call; it only
// sends for a request that is still 'new'; and the database allows exactly one
// send per request, however many times this is called.
import { sendExperienceRequestNotification } from './_notify.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { requestId } = req.body ?? {}
  if (typeof requestId !== 'string' || !UUID_RE.test(requestId)) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  try {
    const result = await sendExperienceRequestNotification({ requestId })
    return res.status(200).json(result)
  } catch (err) {
    console.error('[notify-experience] unexpected failure:', err)
    return res.status(200).json({ sent: false, reason: 'error' })
  }
}

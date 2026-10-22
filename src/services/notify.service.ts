export type NotifyEvent = 'enquiry' | 'confirmed' | 'cancelled' | 'review_submitted'

/**
 * Asks the server to email the guest about a booking event. Fire-and-forget:
 * a failed email must never fail the booking or status change that
 * triggered it, so every error is swallowed. The server decides whether
 * anything is actually sent (email configured, right booking state, not
 * already sent).
 */
export function notifyBooking(event: NotifyEvent, bookingId: string): void {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, bookingId }),
    keepalive: true,
  }).catch(() => {})
}

/**
 * Asks the server to email about a new experience request (a confirmation to the
 * guest and an alert to the business). Fire-and-forget like notifyBooking: the
 * server sends at most once per request and never fails the request itself.
 */
export function notifyExperienceRequest(requestId: string): void {
  fetch('/api/notify-experience', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId }),
    keepalive: true,
  }).catch(() => {})
}

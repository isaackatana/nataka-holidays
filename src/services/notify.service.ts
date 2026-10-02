export type NotifyEvent = 'enquiry' | 'confirmed' | 'cancelled'

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

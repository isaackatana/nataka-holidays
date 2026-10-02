/** Normalises a Kenyan mobile number to 2547XXXXXXXX / 2541XXXXXXXX, or
 * null. Mirrors normalizeKenyanPhone in api/_mpesa.js (the server copy). */
export function normalizeKenyanPhone(input: string | null | undefined): string | null {
  const digits = String(input ?? '').replace(/\D/g, '')
  let full: string | null = null
  if (digits.startsWith('254') && digits.length === 12) full = digits
  else if (digits.startsWith('0') && digits.length === 10) full = `254${digits.slice(1)}`
  else if (digits.length === 9) full = `254${digits}`
  return full && /^254[17]\d{8}$/.test(full) ? full : null
}

/** wa.me link to message a GUEST, or null if their number isn't a valid
 * Kenyan mobile (we don't guess at international formats). */
export function buildGuestWhatsAppLink(phone: string, message: string): string | null {
  const number = normalizeKenyanPhone(phone)
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null
}

export function buildGuestStatusMessage(opts: {
  guestName: string
  propertyTitle: string | null
  dates: string
  status: 'pending' | 'contacted' | 'confirmed' | 'cancelled' | 'completed'
}): string {
  const first = opts.guestName.trim().split(/\s+/)[0] || 'there'
  const stay = `${opts.propertyTitle ?? 'your stay'} (${opts.dates})`
  switch (opts.status) {
    case 'confirmed':
      return `Hello ${first}, your booking for ${stay} with Nataka Holidays is confirmed. We'll send an M-Pesa prompt to this number for payment.`
    case 'cancelled':
      return `Hello ${first}, your booking for ${stay} with Nataka Holidays has been cancelled. Let us know if you'd like to look at other dates.`
    case 'completed':
      return `Hello ${first}, thank you for staying with Nataka Holidays. We'd love to hear how ${opts.propertyTitle ?? 'your stay'} was.`
    default:
      return `Hello ${first}, thanks for your enquiry about ${stay} with Nataka Holidays. `
  }
}

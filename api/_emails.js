// Email content + the rules for when each email may go out. Pure functions
// (no network), so they're unit-tested. The leading underscore keeps
// Vercel from exposing this file as an endpoint.

const ENQUIRY_WINDOW_MS = 15 * 60 * 1000

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function kes(amount) {
  return `KSh ${Math.round(Number(amount) || 0).toLocaleString('en-KE')}`
}

function longDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-KE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

/** Today's date (yyyy-mm-dd) in East Africa Time, where the business operates. */
export function eatDate(now = Date.now()) {
  return new Date(now + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export const REMINDER_DAYS_AHEAD = 3

/** Bookings arriving from today up to N days ahead are due a reminder. */
export function reminderWindow(now = Date.now()) {
  const from = eatDate(now)
  const to = eatDate(now + REMINDER_DAYS_AHEAD * 24 * 60 * 60 * 1000)
  return { from, to }
}

/** '14:00:00' -> '2:00 PM' */
export function clockTime(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''))
  if (!m) return ''
  const h = Number(m[1])
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`
}

/**
 * Whether `event` may be sent for a booking in its CURRENT state. This is
 * what stops anyone calling the public endpoint to trigger, say, a
 * "confirmed" email for a booking that isn't confirmed.
 */
export function eventAllowed(event, booking, now = Date.now()) {
  switch (event) {
    case 'enquiry':
      return booking.status === 'pending' && now - new Date(booking.created_at).getTime() < ENQUIRY_WINDOW_MS
    case 'confirmed':
      return booking.status === 'confirmed'
    case 'cancelled':
      return booking.status === 'cancelled'
    case 'reminder': {
      const { from, to } = reminderWindow(now)
      return booking.status === 'confirmed' && booking.check_in >= from && booking.check_in <= to
    }
    case 'payment':
      return true // only ever triggered server-side from the verified M-Pesa callback
    default:
      return false
  }
}

function layout({ business, heading, bodyHtml, siteUrl }) {
  const name = escapeHtml(business?.name || 'Nataka Holidays')
  const contact = [business?.phone, business?.email].filter(Boolean).map(escapeHtml).join(' · ')
  return `<!doctype html><html><body style="margin:0;background:#f7f2e9;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:#0f3d3e;color:#f7f2e9;padding:20px 28px;font-size:18px;font-weight:bold">${name}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:20px;color:#0f3d3e">${heading}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px;background:#f7f2e9;font-size:12px;color:#777">${contact ? `${contact}<br>` : ''}<a href="${escapeHtml(siteUrl)}" style="color:#777">${escapeHtml(siteUrl.replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table></body></html>`
}

function detailsTable(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid #eee">${rows
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#777;font-size:14px">${escapeHtml(k)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right">${escapeHtml(v)}</td></tr>`,
    )
    .join('')}</table>`
}

function stayRows(ctx) {
  const b = ctx.booking
  return [
    ['Property', ctx.property_title || 'Your stay'],
    ['Check-in', longDate(b.check_in)],
    ['Check-out', longDate(b.check_out)],
    ['Nights', String(b.nights)],
    ['Guests', String(b.guests)],
    ['Estimated total', b.estimated_total != null ? kes(b.estimated_total) : null],
  ]
}

const p = (html) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${html}</p>`

/**
 * Builds the emails for an event. Returns [{ to: 'guest' | 'admin', subject, html, text }].
 * `extra` carries payment details for the 'payment' event.
 */
export function buildEmails(event, ctx, { siteUrl, extra } = {}) {
  const b = ctx.booking
  const business = ctx.business
  const first = escapeHtml((b.guest_name || '').split(' ')[0] || 'there')
  const title = ctx.property_title || 'your stay'
  const contactLine = business?.phone || business?.email
    ? `Questions? Reach us on ${escapeHtml([business.phone, business.email].filter(Boolean).join(' or '))}.`
    : ''
  const wrap = (heading, bodyHtml) => layout({ business, heading, bodyHtml, siteUrl })
  const plain = (lines) => lines.filter(Boolean).join('\n')

  if (event === 'enquiry') {
    const guestMail = {
      to: 'guest',
      subject: `We've received your enquiry — ${title}`,
      html: wrap(
        'Thanks for your enquiry',
        p(`Hi ${first}, we've received your enquiry and will get back to you shortly to confirm availability and next steps.`) +
          detailsTable(stayRows(ctx)) +
          p('Nothing is charged yet, and these dates are not held until we confirm.') +
          (contactLine ? p(contactLine) : ''),
      ),
      text: plain([
        `Hi ${b.guest_name}, we've received your enquiry for ${title} (${b.check_in} to ${b.check_out}).`,
        "We'll be in touch shortly. Nothing is charged yet, and the dates aren't held until we confirm.",
      ]),
    }
    const adminMail = {
      to: 'admin',
      subject: `New enquiry: ${b.guest_name} — ${title}`,
      html: wrap(
        'New booking enquiry',
        detailsTable([
          ['Guest', b.guest_name],
          ['Email', b.guest_email],
          ['Phone', b.guest_phone],
          ...stayRows(ctx),
          ['Message', b.message],
        ]) + p(`<a href="${escapeHtml(siteUrl)}/admin/bookings" style="color:#0f3d3e">Open bookings</a>`),
      ),
      text: plain([
        `New enquiry from ${b.guest_name} (${b.guest_phone}, ${b.guest_email}) for ${title}, ${b.check_in} to ${b.check_out}.`,
        b.message ? `Message: ${b.message}` : '',
        `${siteUrl}/admin/bookings`,
      ]),
    }
    return [guestMail, adminMail]
  }

  if (event === 'confirmed') {
    return [{
      to: 'guest',
      subject: `Your stay is confirmed — ${title}`,
      html: wrap(
        'Your stay is confirmed',
        p(`Hi ${first}, great news: your booking is confirmed.`) +
          detailsTable(stayRows(ctx)) +
          p(`We'll be in touch about payment. If you have an account, you can also pay by M-Pesa under <a href="${escapeHtml(siteUrl)}/my-bookings" style="color:#0f3d3e">My bookings</a>.`) +
          (contactLine ? p(contactLine) : ''),
      ),
      text: plain([
        `Hi ${b.guest_name}, your booking for ${title} is confirmed (${b.check_in} to ${b.check_out}).`,
        `You can also pay by M-Pesa under My bookings: ${siteUrl}/my-bookings`,
      ]),
    }]
  }

  if (event === 'cancelled') {
    return [{
      to: 'guest',
      subject: `Your booking was cancelled — ${title}`,
      html: wrap(
        'Your booking was cancelled',
        p(`Hi ${first}, your booking for ${escapeHtml(title)} (${escapeHtml(longDate(b.check_in))} – ${escapeHtml(longDate(b.check_out))}) has been cancelled.`) +
          p("If this is unexpected, or you'd like to look at other dates, just get in touch.") +
          (contactLine ? p(contactLine) : ''),
      ),
      text: plain([
        `Hi ${b.guest_name}, your booking for ${title} (${b.check_in} to ${b.check_out}) has been cancelled.`,
        "If this is unexpected, please get in touch.",
      ]),
    }]
  }

  if (event === 'reminder') {
    const prop = ctx.property ?? {}
    const paid = Number(ctx.paid_total) || 0
    const total = b.estimated_total != null ? Number(b.estimated_total) : null
    const balance = total != null ? Math.max(total - paid, 0) : 0
    const hasCoords = prop.latitude != null && prop.longitude != null
    const mapUrl = hasCoords
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${prop.latitude},${prop.longitude}`)}`
      : null
    const inTime = clockTime(prop.check_in_time)
    const outTime = clockTime(prop.check_out_time)
    const rules = String(prop.house_rules ?? '').trim()

    const rows = [
      ['Property', title],
      ['Check-in', `${longDate(b.check_in)}${inTime ? `, from ${inTime}` : ''}`],
      ['Check-out', `${longDate(b.check_out)}${outTime ? `, by ${outTime}` : ''}`],
      ['Location', prop.location],
      ['Guests', String(b.guests)],
    ]
    const balanceNote = balance > 0
      ? p(`<strong>Balance due: ${escapeHtml(kes(balance))}.</strong> You can pay by M-Pesa under <a href="${escapeHtml(siteUrl)}/my-bookings" style="color:#0f3d3e">My bookings</a>, or reply and we'll send a payment prompt to your phone.`)
      : ''
    return [{
      to: 'guest',
      subject: `Your stay starts ${longDate(b.check_in)} — ${title}`,
      html: wrap(
        'Your stay is coming up',
        p(`Hi ${first}, we're looking forward to welcoming you. Here are your arrival details.`) +
          detailsTable(rows) +
          (mapUrl ? p(`<a href="${escapeHtml(mapUrl)}" style="color:#0f3d3e">Open the location in Google Maps</a>`) : '') +
          balanceNote +
          (rules ? p(`<strong>House rules</strong><br>${escapeHtml(rules).replace(/\r?\n/g, '<br>')}`) : '') +
          (contactLine ? p(contactLine) : ''),
      ),
      text: plain([
        `Hi ${b.guest_name}, your stay at ${title} starts ${b.check_in}${inTime ? ` (check-in from ${inTime})` : ''}.`,
        prop.location ? `Location: ${prop.location}` : '',
        mapUrl ? `Map: ${mapUrl}` : '',
        balance > 0 ? `Balance due: ${kes(balance)}. Pay by M-Pesa under My bookings: ${siteUrl}/my-bookings` : '',
        rules ? `House rules:\n${rules}` : '',
      ]),
    }]
  }

  if (event === 'payment') {
    const paid = Number(ctx.paid_total) || 0
    const total = b.estimated_total != null ? Number(b.estimated_total) : null
    const balance = total != null ? Math.max(total - paid, 0) : null
    const rows = [
      ['Amount received', kes(extra?.amount)],
      ['M-Pesa receipt', extra?.receipt],
      ['Property', title],
      ['Total paid so far', kes(paid)],
      ['Balance remaining', balance != null ? kes(balance) : null],
    ]
    return [
      {
        to: 'guest',
        subject: `Payment received — ${kes(extra?.amount)}`,
        html: wrap(
          'Payment received',
          p(`Hi ${first}, thank you. We've received your M-Pesa payment.`) + detailsTable(rows) +
            (contactLine ? p(contactLine) : ''),
        ),
        text: plain([
          `Hi ${b.guest_name}, we received your M-Pesa payment of ${kes(extra?.amount)} (receipt ${extra?.receipt ?? 'n/a'}).`,
          balance != null ? `Balance remaining: ${kes(balance)}.` : '',
        ]),
      },
      {
        to: 'admin',
        subject: `Payment received: ${kes(extra?.amount)} from ${b.guest_name}`,
        html: wrap('Payment received', detailsTable([['Guest', b.guest_name], ...rows])),
        text: `${b.guest_name} paid ${kes(extra?.amount)} (receipt ${extra?.receipt ?? 'n/a'}) for ${title}.`,
      },
    ]
  }

  return []
}

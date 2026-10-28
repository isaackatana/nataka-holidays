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

export const REVIEW_REQUEST_DAYS_BACK = 14

/** Stays that ended from N days ago up to today are due a review request. */
export function reviewRequestWindow(now = Date.now()) {
  const from = eatDate(now - REVIEW_REQUEST_DAYS_BACK * 24 * 60 * 60 * 1000)
  const to = eatDate(now)
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
    case 'review_request': {
      const { from, to } = reviewRequestWindow(now)
      return booking.status === 'completed' && booking.check_out >= from && booking.check_out <= to
    }
    case 'review_submitted':
      return booking.status === 'completed' // _notify.js also requires a review to exist
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

  if (event === 'review_request') {
    const reviewUrl = `${siteUrl}/my-bookings`
    return [{
      to: 'guest',
      subject: `How was your stay at ${title}?`,
      html: wrap(
        'How was your stay?',
        p(`Hi ${first}, thank you for staying with us at ${escapeHtml(title)}. We'd love to hear how it went.`) +
          p('A short review helps future guests choose with confidence, and it helps us look after you better next time. It only takes a minute.') +
          p(`<a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#0f3d3e;color:#f7f2e9;text-decoration:none;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:bold">Write a review</a>`) +
          p('Sign in with the account you booked with, then open <strong>My bookings</strong>.') +
          (contactLine ? p(contactLine) : ''),
      ),
      text: plain([
        `Hi ${b.guest_name}, thank you for staying with us at ${title}. How was your stay?`,
        `Write a short review here (sign in, then open My bookings): ${reviewUrl}`,
      ]),
    }]
  }

  if (event === 'review_submitted') {
    const r = ctx.review
    if (!r) return []
    const rating = Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0)))
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
    const photos = Number(r.photo_count) || 0
    const reviewUrl = `${siteUrl}/admin/reviews`
    const rows = [
      ['Guest', b.guest_name],
      ['Property', title],
      ['Rating', `${stars} (${rating}/5)`],
      ['Photos', photos > 0 ? String(photos) : null],
    ]
    return [{
      to: 'admin',
      subject: `New review to approve: ${stars} — ${title}`,
      html: wrap(
        'New review to approve',
        p(`${escapeHtml(b.guest_name || 'A guest')} has reviewed ${escapeHtml(title)}. It stays hidden until you approve it.`) +
          detailsTable(rows) +
          (r.comment ? p(`<em>“${escapeHtml(r.comment).replace(/\r?\n/g, '<br>')}”</em>`) : '') +
          p(`<a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#0f3d3e;color:#f7f2e9;text-decoration:none;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:bold">Review it</a>`),
      ),
      text: plain([
        `${b.guest_name} reviewed ${title}: ${stars} (${rating}/5)${photos > 0 ? `, ${photos} photo${photos === 1 ? '' : 's'}` : ''}.`,
        r.comment ? `"${r.comment}"` : '',
        `Approve or reject it: ${reviewUrl}`,
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

/**
 * Emails for a paid shop order. `ctx` is order_notification_context();
 * `receipt` is the M-Pesa receipt number.
 */
export function buildOrderEmails(ctx, { siteUrl, receipt } = {}) {
  const o = ctx.order
  const items = ctx.items ?? []
  const first = escapeHtml(String(o.customer_name || '').split(' ')[0] || 'there')
  const itemRows = items.map((i) => [`${i.quantity} × ${i.name}`, kes(i.unit_price * i.quantity)])
  const how =
    o.fulfilment === 'delivery'
      ? ['Delivery to', o.delivery_address]
      : ['Hand-over at', o.handover_note]
  const rows = [
    ...itemRows,
    o.discount_amount > 0 ? [`Discount (${o.discount_code})`, `−${kes(o.discount_amount)}`] : null,
    o.delivery_fee > 0 ? ['Delivery fee', kes(o.delivery_fee)] : null,
    o.gift_wrap ? ['Gift wrap', kes(o.gift_wrap_fee)] : null,
    o.gift_wrap && o.gift_message ? ['Gift message', o.gift_message] : null,
    ['Total paid', kes(o.total)],
    receipt ? ['M-Pesa receipt', receipt] : null,
    how,
  ].filter(Boolean)
  const wrap = (heading, bodyHtml) => layout({ business: ctx.business, heading, bodyHtml, siteUrl })
  const p = (t) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${t}</p>`
  const nextStep =
    o.fulfilment === 'delivery'
      ? "We'll pack your order and deliver it to the address above. We'll contact you on the number you gave if we need anything."
      : "We'll hand your order to you during your stay."
  const contact = [ctx.business?.phone, ctx.business?.email].filter(Boolean).join(' · ')
  const text = (lines) => lines.filter(Boolean).join('\n')

  return [
    {
      to: 'guest',
      subject: `Order received — ${kes(o.total)}`,
      html: wrap(
        'Thank you for your order',
        p(`Hi ${first}, we've received your payment.`) + detailsTable(rows) + p(escapeHtml(nextStep)) +
          (contact ? p(`Questions? ${escapeHtml(contact)}`) : ''),
      ),
      text: text([
        `Hi ${o.customer_name}, we've received your payment of ${kes(o.total)}${receipt ? ` (receipt ${receipt})` : ''}.`,
        ...items.map((i) => `${i.quantity} x ${i.name} - ${kes(i.unit_price * i.quantity)}`),
        `${how[0]}: ${how[1]}`,
        nextStep,
      ]),
    },
    {
      to: 'admin',
      subject: `New shop order: ${kes(o.total)} from ${o.customer_name}`,
      html: wrap(
        'New shop order (paid)',
        detailsTable([['Customer', o.customer_name], ['Phone', o.customer_phone], ...rows]),
      ),
      text: text([
        `${o.customer_name} (${o.customer_phone}) paid ${kes(o.total)}.`,
        ...items.map((i) => `${i.quantity} x ${i.name}`),
        `${how[0]}: ${how[1]}`,
      ]),
    },
  ]
}

/**
 * Emails for a new experience request. `ctx` is experience_request_context():
 * { request, meeting_point, business }. One confirmation to the guest and one
 * alert to the business. Nothing here promises the booking: it is a request.
 */
export function buildExperienceRequestEmails(ctx, { siteUrl } = {}) {
  const r = ctx.request
  const first = escapeHtml(String(r.guest_name || '').split(' ')[0] || 'there')
  const when = longDate(r.preferred_date)
  const people = `${r.people} ${r.people === 1 ? 'person' : 'people'}`
  const total = r.estimated_total != null ? kes(r.estimated_total) : null
  const wrap = (heading, bodyHtml) => layout({ business: ctx.business, heading, bodyHtml, siteUrl })
  const contact = [ctx.business?.phone, ctx.business?.email].filter(Boolean).join(' · ')
  const text = (lines) => lines.filter(Boolean).join('\n')
  const rows = [
    ['Experience', r.experience_title],
    ['Preferred date', when],
    ['Group', people],
    ['Estimated total', total],
  ]
  const adminUrl = `${siteUrl}/admin/experience-requests`

  return [
    {
      to: 'guest',
      subject: `We've received your request: ${r.experience_title}`,
      html: wrap(
        'We have your request',
        p(`Hi ${first}, thanks for asking about ${escapeHtml(r.experience_title)}. We'll check availability for your date and confirm by WhatsApp or email.`) +
          detailsTable(rows) +
          p('Nothing has been charged. This is a request, not a confirmed booking, and the final price is confirmed by us.') +
          (contact ? p(`Questions? ${escapeHtml(contact)}`) : ''),
      ),
      text: text([
        `Hi ${r.guest_name}, thanks for asking about ${r.experience_title}.`,
        `Preferred date: ${when}. Group: ${people}.${total ? ` Estimated total: ${total}.` : ''}`,
        "We'll check availability and confirm by WhatsApp or email. Nothing has been charged; this is a request, not a confirmed booking.",
        contact,
      ]),
    },
    {
      to: 'admin',
      subject: `New experience request: ${r.experience_title}, ${people}, ${when}`,
      html: wrap(
        'New experience request',
        detailsTable([['Guest', r.guest_name], ['Phone', r.guest_phone], ['Email', r.guest_email], ...rows]) +
          (r.message ? p(`<em>\u201c${escapeHtml(r.message).replace(/\r?\n/g, '<br>')}\u201d</em>`) : '') +
          p(`<a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#0f3d3e;color:#f7f2e9;text-decoration:none;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:bold">Open requests</a>`),
      ),
      text: text([
        `${r.guest_name} (${r.guest_phone}, ${r.guest_email}) asked for ${r.experience_title}: ${people} on ${when}.${total ? ` Estimated ${total}.` : ''}`,
        r.message ? `"${r.message}"` : '',
        `Respond: ${adminUrl}`,
      ]),
    },
  ]
}

/**
 * Emails for a successful experience payment. `ctx` is experience_payment_context():
 * { payment, request, business }. A receipt for the guest, an alert for the business.
 */
export function buildExperiencePaymentEmails(ctx, { siteUrl } = {}) {
  const pay = ctx.payment
  const r = ctx.request
  const first = escapeHtml(String(r.guest_name || '').split(' ')[0] || 'there')
  const when = longDate(r.preferred_date)
  const people = `${r.people} ${r.people === 1 ? 'person' : 'people'}`
  const wrap = (heading, bodyHtml) => layout({ business: ctx.business, heading, bodyHtml, siteUrl })
  const text = (lines) => lines.filter(Boolean).join('\n')
  const balance = r.total != null ? Math.max(Number(r.total) - Number(r.paid), 0) : null
  const status =
    balance === null ? null : balance > 0 ? `Balance still to pay: ${kes(balance)}` : 'Fully paid. Thank you!'
  const contact = [ctx.business?.phone, ctx.business?.email].filter(Boolean).join(' · ')
  const rows = [
    ['Experience', r.experience_title],
    ['Date', when],
    ['Group', people],
    ['Amount received', kes(pay.amount)],
    ['M-Pesa receipt', pay.receipt],
    ['Total paid so far', r.total != null ? `${kes(r.paid)} of ${kes(r.total)}` : kes(r.paid)],
  ]
  const adminUrl = `${siteUrl}/admin/experience-requests`

  return [
    {
      to: 'guest',
      subject: `Payment received: ${r.experience_title}`,
      html: wrap(
        'Payment received',
        p(`Hi ${first}, we've received your payment of ${escapeHtml(kes(pay.amount))} for ${escapeHtml(r.experience_title)}. Thank you!`) +
          detailsTable(rows) +
          (status ? p(escapeHtml(status)) : '') +
          (contact ? p(`Questions? ${escapeHtml(contact)}`) : ''),
      ),
      text: text([
        `Hi ${r.guest_name}, we've received your payment of ${kes(pay.amount)} for ${r.experience_title} on ${when}.`,
        pay.receipt ? `M-Pesa receipt: ${pay.receipt}.` : '',
        status,
        contact,
      ]),
    },
    {
      to: 'admin',
      subject: `Experience payment: ${kes(pay.amount)} from ${r.guest_name}`,
      html: wrap(
        'Experience payment received',
        detailsTable([['Guest', r.guest_name], ['Phone', r.guest_phone], ...rows]) +
          (status ? p(escapeHtml(status)) : '') +
          p(`<a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#0f3d3e;color:#f7f2e9;text-decoration:none;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:bold">Open requests</a>`),
      ),
      text: text([
        `${r.guest_name} paid ${kes(pay.amount)} for ${r.experience_title} on ${when}${pay.receipt ? ` (receipt ${pay.receipt})` : ''}.`,
        status,
        adminUrl,
      ]),
    },
  ]
}

/**
 * Daily "running low" e-mail to the business. `ctx` is low_stock_items():
 * { threshold, items: [{ name, option, stock }], business }. Returns one
 * admin e-mail, or null when nothing is low.
 */
export function buildLowStockEmail(ctx, { siteUrl } = {}) {
  const items = ctx?.items ?? []
  if (items.length === 0) return null
  const label = (i) => (i.option ? `${i.name} (${i.option})` : i.name)
  const left = (n) => (n <= 0 ? 'Sold out' : `${n} left`)
  const soldOut = items.filter((i) => i.stock <= 0).length
  const subject =
    items.length === 1
      ? `Low stock: ${label(items[0])}${items[0].stock <= 0 ? ' is sold out' : ` (${items[0].stock} left)`}`
      : `Low stock: ${items.length} shop items need restocking${soldOut ? ` (${soldOut} sold out)` : ''}`
  const adminUrl = `${String(siteUrl || '').replace(/\/$/, '')}/admin/products`
  const html = layout({
    business: ctx.business,
    heading: 'Shop stock is running low',
    siteUrl: siteUrl || '',
    bodyHtml:
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">These items have ${escapeHtml(ctx.threshold)} or fewer left.</p>` +
      detailsTable(items.map((i) => [label(i), left(i.stock)])) +
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.5"><a href="${escapeHtml(adminUrl)}" style="color:#0f3d3e">Open Products to update stock</a></p>`,
  })
  const text = [
    `These shop items have ${ctx.threshold} or fewer left:`,
    ...items.map((i) => `${label(i)}: ${left(i.stock)}`),
    `Update stock: ${adminUrl}`,
  ].join('\n')
  return { to: 'admin', subject, html, text }
}

/**
 * "It's back" e-mail for one guest. `guest` is one entry of back_in_stock_due():
 * { name, email, items: [{ name, option, slug, stock }] }. The caller sends it
 * to guest.email.
 */
export function buildBackInStockEmail(guest, business, { siteUrl } = {}) {
  const items = guest?.items ?? []
  if (items.length === 0) return null
  const base = String(siteUrl || '').replace(/\/$/, '')
  const label = (i) => (i.option ? `${i.name} (${i.option})` : i.name)
  const first = String(guest.name || '').trim().split(/\s+/)[0]
  const subject =
    items.length === 1 ? `Back in stock: ${label(items[0])}` : `${items.length} items you wanted are back in stock`
  const linkTable =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid #eee">' +
    items
      .map(
        (i) =>
          `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(label(i))}</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right"><a href="${escapeHtml(`${base}/shop/${i.slug}`)}" style="color:#0f3d3e">View in the shop</a></td></tr>`,
      )
      .join('') +
    '</table>'
  const html = layout({
    business,
    heading: 'Good news, it\'s back',
    siteUrl: siteUrl || '',
    bodyHtml:
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${first ? `Hello ${escapeHtml(first)}, ` : ''}${items.length === 1 ? 'something you asked about is' : 'things you asked about are'} back in the Nataka Holidays shop. Stock is limited, so order soon if you still want ${items.length === 1 ? 'it' : 'them'}.</p>` +
      linkTable,
  })
  const text = [
    `${first ? `Hello ${first}, ` : ''}${items.length === 1 ? 'something you asked about is' : 'things you asked about are'} back in the shop:`,
    ...items.map((i) => `${label(i)}: ${base}/shop/${i.slug}`),
  ].join('\n')
  return { subject, html, text }
}

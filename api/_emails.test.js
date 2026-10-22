import { describe, expect, it } from 'vitest'
import {
  buildEmails, buildExperiencePaymentEmails, buildExperienceRequestEmails, clockTime, eatDate, escapeHtml, eventAllowed, kes, reminderWindow, reviewRequestWindow,
} from './_emails.js'

const now = new Date('2026-10-01T12:00:00Z').getTime()
const booking = {
  id: 'b1', guest_name: 'Amina <b>Hassan</b>', guest_email: 'a@example.com', guest_phone: '0712345678',
  check_in: '2026-11-01', check_out: '2026-11-04', nights: 3, guests: 2, message: 'Late arrival <script>',
  estimated_total: 90000, status: 'pending', created_at: '2026-10-01T11:55:00Z',
}
const ctx = {
  booking, property_title: 'Beach Villa', paid_total: 30000,
  business: { name: 'Nataka Holidays', phone: '+254700000000', email: 'hi@example.com' },
}
const opts = { siteUrl: 'https://natakaholidays.co.ke' }

describe('escapeHtml / kes', () => {
  it('escapes markup', () => expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;'))
  it('formats shillings', () => expect(kes(90000)).toMatch(/^KSh 90.?000$/))
})

describe('eventAllowed', () => {
  it('only allows an enquiry email for a fresh pending booking', () => {
    expect(eventAllowed('enquiry', booking, now)).toBe(true)
    expect(eventAllowed('enquiry', { ...booking, created_at: '2026-10-01T10:00:00Z' }, now)).toBe(false)
    expect(eventAllowed('enquiry', { ...booking, status: 'confirmed' }, now)).toBe(false)
  })
  it('requires the matching status for confirmed / cancelled', () => {
    expect(eventAllowed('confirmed', { ...booking, status: 'confirmed' }, now)).toBe(true)
    expect(eventAllowed('confirmed', booking, now)).toBe(false)
    expect(eventAllowed('cancelled', { ...booking, status: 'cancelled' }, now)).toBe(true)
    expect(eventAllowed('cancelled', booking, now)).toBe(false)
  })
  it('rejects unknown events', () => expect(eventAllowed('refund', booking, now)).toBe(false))
})

describe('buildEmails', () => {
  it('sends an enquiry acknowledgement to the guest and an alert to the admin', () => {
    const mails = buildEmails('enquiry', ctx, opts)
    expect(mails.map((m) => m.to)).toEqual(['guest', 'admin'])
    expect(mails[0].subject).toContain('Beach Villa')
  })

  it('escapes guest-supplied text in HTML', () => {
    const html = buildEmails('enquiry', ctx, opts)[1].html
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>Hassan</b>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('confirmation and cancellation go to the guest only', () => {
    expect(buildEmails('confirmed', ctx, opts).map((m) => m.to)).toEqual(['guest'])
    expect(buildEmails('cancelled', ctx, opts).map((m) => m.to)).toEqual(['guest'])
  })

  it('payment receipt shows the balance remaining and notifies the admin too', () => {
    const mails = buildEmails('payment', ctx, { ...opts, extra: { amount: 30000, receipt: 'SIA1B2C3D4' } })
    expect(mails.map((m) => m.to)).toEqual(['guest', 'admin'])
    expect(mails[0].html).toContain('SIA1B2C3D4')
    expect(mails[0].html).toMatch(/KSh 60.?000/) // 90,000 total - 30,000 paid
  })

  it('returns nothing for an unknown event', () => expect(buildEmails('nope', ctx, opts)).toEqual([]))
})

describe('reminders', () => {
  const t = new Date('2026-10-01T22:30:00Z').getTime() // already 2 Oct in East Africa
  const confirmed = { ...booking, status: 'confirmed', check_in: '2026-10-04', check_out: '2026-10-07' }

  it('uses East Africa dates for the window', () => {
    expect(eatDate(t)).toBe('2026-10-02')
    expect(reminderWindow(t)).toEqual({ from: '2026-10-02', to: '2026-10-05' })
  })

  it('only allows confirmed bookings arriving within the window', () => {
    expect(eventAllowed('reminder', confirmed, t)).toBe(true)
    expect(eventAllowed('reminder', { ...confirmed, check_in: '2026-10-06' }, t)).toBe(false) // too far ahead
    expect(eventAllowed('reminder', { ...confirmed, check_in: '2026-10-01' }, t)).toBe(false) // already started
    expect(eventAllowed('reminder', { ...confirmed, status: 'cancelled' }, t)).toBe(false)
  })

  it('formats clock times', () => {
    expect(clockTime('14:00:00')).toBe('2:00 PM')
    expect(clockTime('10:30:00')).toBe('10:30 AM')
    expect(clockTime('00:15:00')).toBe('12:15 AM')
    expect(clockTime(null)).toBe('')
  })

  const reminderCtx = {
    ...ctx,
    booking: confirmed,
    property: {
      location: 'Diani Beach', latitude: -4.3, longitude: 39.57,
      check_in_time: '14:00:00', check_out_time: '10:00:00', house_rules: 'No parties\n<b>Quiet after 10pm</b>',
    },
  }

  it('includes arrival details, a map link, the balance due, and escaped house rules', () => {
    const [mail] = buildEmails('reminder', reminderCtx, opts)
    expect(mail.to).toBe('guest')
    expect(mail.html).toContain('2:00 PM')
    expect(mail.html).toContain('google.com/maps/search/?api=1&amp;query=-4.3%2C39.57')
    expect(mail.html).toMatch(/Balance due: KSh 60.?000/) // 90,000 - 30,000 paid
    expect(mail.html).toContain('No parties<br>&lt;b&gt;Quiet after 10pm&lt;/b&gt;')
  })

  it('omits the balance and map when not applicable', () => {
    const paidUp = { ...reminderCtx, paid_total: 90000, property: { ...reminderCtx.property, latitude: null, longitude: null } }
    const [mail] = buildEmails('reminder', paidUp, opts)
    expect(mail.html).not.toContain('Balance due')
    expect(mail.html).not.toContain('google.com/maps')
  })
})

describe('review requests', () => {
  const t = new Date('2026-10-15T09:00:00Z').getTime()
  const done = { ...booking, status: 'completed', check_in: '2026-10-10', check_out: '2026-10-13' }

  it('looks back two weeks, in East Africa dates', () => {
    expect(reviewRequestWindow(t)).toEqual({ from: '2026-10-01', to: '2026-10-15' })
  })

  it('only allows completed stays that ended recently', () => {
    expect(eventAllowed('review_request', done, t)).toBe(true)
    expect(eventAllowed('review_request', { ...done, check_out: '2026-09-20' }, t)).toBe(false) // too long ago
    expect(eventAllowed('review_request', { ...done, check_out: '2026-10-20' }, t)).toBe(false) // not ended yet
    expect(eventAllowed('review_request', { ...done, status: 'confirmed' }, t)).toBe(false)
    expect(eventAllowed('review_request', { ...done, status: 'cancelled' }, t)).toBe(false)
  })

  it('sends one guest-only email linking to My bookings, with guest text escaped', () => {
    const mails = buildEmails('review_request', { ...ctx, booking: done }, opts)
    expect(mails.map((m) => m.to)).toEqual(['guest'])
    expect(mails[0].subject).toContain('Beach Villa')
    expect(mails[0].html).toContain('https://natakaholidays.co.ke/my-bookings')
    expect(mails[0].html).not.toContain('<b>Hassan</b>')
    expect(mails[0].text).toContain('/my-bookings')
  })
})

describe('review_submitted alert', () => {
  const done = { ...booking, status: 'completed' }
  const reviewCtx = {
    ...ctx,
    booking: done,
    review: { rating: 4, comment: 'Lovely <script>alert(1)</script>\nSee you soon', status: 'pending', photo_count: 2 },
  }

  it('is only allowed for a completed stay', () => {
    expect(eventAllowed('review_submitted', done, now)).toBe(true)
    expect(eventAllowed('review_submitted', booking, now)).toBe(false)
  })

  it('goes to the admin only, with stars, photo count and an admin link', () => {
    const mails = buildEmails('review_submitted', reviewCtx, opts)
    expect(mails.map((m) => m.to)).toEqual(['admin'])
    expect(mails[0].subject).toContain('★★★★☆')
    expect(mails[0].subject).toContain('Beach Villa')
    expect(mails[0].html).toContain('https://natakaholidays.co.ke/admin/reviews')
    expect(mails[0].html).toContain('>2<')
  })

  it("escapes the guest's text", () => {
    const html = buildEmails('review_submitted', reviewCtx, opts)[0].html
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<br>See you soon')
  })

  it('sends nothing when there is no review', () => {
    expect(buildEmails('review_submitted', { ...ctx, booking: done }, opts)).toEqual([])
  })
})

describe('experience request emails', () => {
  const ctx = {
    request: {
      id: 'r1', experience_title: 'Dhow Trip', guest_name: 'Amina Kamau', guest_email: 'a@x.com',
      guest_phone: '0712345678', preferred_date: '2026-12-01', people: 3, message: 'Vegetarian <b>please</b>',
      price_type: 'per_person', unit_price: 5000, estimated_total: 15000, status: 'new', notified: false,
    },
    business: { name: 'Nataka Holidays', phone: '+254 700', email: 'hi@nataka.co.ke' },
  }
  const mails = buildExperienceRequestEmails(ctx, { siteUrl: 'https://natakaholidays.co.ke' })

  it('sends one confirmation to the guest and one alert to the business', () => {
    expect(mails.map((m) => m.to)).toEqual(['guest', 'admin'])
  })

  it('tells the guest it is a request, not a booking, with nothing charged', () => {
    expect(mails[0].html).toContain('Nothing has been charged')
    expect(mails[0].html).toContain('15,000')
    expect(mails[0].subject).toContain('Dhow Trip')
  })

  it('gives the business the guest contact, group, date and a link to the requests page', () => {
    expect(mails[1].subject).toContain('3 people')
    expect(mails[1].html).toContain('0712345678')
    expect(mails[1].html).toContain('https://natakaholidays.co.ke/admin/experience-requests')
  })

  it("escapes the guest's message", () => {
    expect(mails[1].html).not.toContain('<b>please</b>')
    expect(mails[1].html).toContain('&lt;b&gt;please&lt;/b&gt;')
  })

  it('omits the total when the price basis is not set', () => {
    const noTotal = buildExperienceRequestEmails(
      { ...ctx, request: { ...ctx.request, estimated_total: null } },
      { siteUrl: 'https://natakaholidays.co.ke' },
    )
    expect(noTotal[0].html).not.toContain('Estimated total')
  })

  it('uses the singular for one person', () => {
    const one = buildExperienceRequestEmails(
      { ...ctx, request: { ...ctx.request, people: 1 } },
      { siteUrl: 'https://natakaholidays.co.ke' },
    )
    expect(one[1].subject).toContain('1 person,')
  })
})

describe('experience payment emails', () => {
  const base = {
    payment: { id: 'p1', amount: 3000, receipt: 'QWE123ABC', method: 'mpesa' },
    request: {
      id: 'r1', experience_title: 'Dhow Trip', guest_name: 'Amina Kamau', guest_email: 'a@x.com',
      guest_phone: '0712345678', preferred_date: '2026-12-01', people: 3, total: 10000, paid: 3000,
    },
    business: { name: 'Nataka Holidays', phone: '+254 700', email: 'hi@nataka.co.ke' },
  }
  const opts = { siteUrl: 'https://natakaholidays.co.ke' }

  it('sends a receipt to the guest and an alert to the business', () => {
    const mails = buildExperiencePaymentEmails(base, opts)
    expect(mails.map((m) => m.to)).toEqual(['guest', 'admin'])
    expect(mails[0].subject).toContain('Dhow Trip')
    expect(mails[0].html).toContain('QWE123ABC')
    expect(mails[0].html).toContain('3,000')
    expect(mails[1].subject).toContain('Amina Kamau')
    expect(mails[1].html).toContain('https://natakaholidays.co.ke/admin/experience-requests')
  })

  it('shows the balance still to pay after a deposit', () => {
    expect(buildExperiencePaymentEmails(base, opts)[0].html).toContain('Balance still to pay: KSh 7,000')
  })

  it('says fully paid when nothing is left', () => {
    const paid = { ...base, request: { ...base.request, paid: 10000 } }
    expect(buildExperiencePaymentEmails(paid, opts)[0].html).toContain('Fully paid')
  })

  it('does not claim a balance when the total is unknown', () => {
    const noTotal = { ...base, request: { ...base.request, total: null } }
    const html = buildExperiencePaymentEmails(noTotal, opts)[0].html
    expect(html).not.toContain('Balance still to pay')
    expect(html).not.toContain('Fully paid')
  })

  it("escapes the guest's name", () => {
    const evil = { ...base, request: { ...base.request, guest_name: '<script>x</script> Amina' } }
    expect(buildExperiencePaymentEmails(evil, opts)[1].html).not.toContain('<script>')
  })
})

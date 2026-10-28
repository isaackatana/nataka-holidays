import { describe, expect, it, vi } from 'vitest'
import { orderPayError, requestStkPush } from './_mpesa.js'
import { buildBackInStockEmail, buildLowStockEmail, buildOrderEmails } from './_emails.js'

const now = new Date('2026-10-13T12:00:00Z').getTime()
const order = (over = {}) => ({
  customer_id: 'u1',
  status: 'pending_payment',
  expires_at: new Date(now + 20 * 60_000).toISOString(),
  ...over,
})

describe('orderPayError', () => {
  it('lets the owner pay an open order', () => {
    expect(orderPayError({ order: order(), userId: 'u1', payments: [], now })).toBeNull()
  })
  it("refuses someone else's order or a signed-out caller", () => {
    expect(orderPayError({ order: order(), userId: 'u2', payments: [], now })).toMatch(/not your order/)
    expect(orderPayError({ order: order(), userId: null, payments: [], now })).toMatch(/not your order/)
  })
  it.each(['paid', 'packed', 'completed'])('refuses an order that is already %s', (status) => {
    expect(orderPayError({ order: order({ status }), userId: 'u1', payments: [], now })).toMatch(/already paid/)
  })
  it.each(['cancelled', 'expired'])('refuses a %s order', (status) => {
    expect(orderPayError({ order: order({ status }), userId: 'u1', payments: [], now })).toMatch(/no longer be paid/)
  })
  it('refuses an order past its expiry time', () => {
    const late = order({ expires_at: new Date(now - 1000).toISOString() })
    expect(orderPayError({ order: late, userId: 'u1', payments: [], now })).toMatch(/expired/)
  })
  it('asks the customer to wait if a prompt was just sent, but not after a failure or a minute and a half', () => {
    const fresh = { status: 'pending', created_at: new Date(now - 30_000).toISOString() }
    const old = { status: 'pending', created_at: new Date(now - 120_000).toISOString() }
    const failed = { status: 'failed', created_at: new Date(now - 10_000).toISOString() }
    expect(orderPayError({ order: order(), userId: 'u1', payments: [fresh], now })).toMatch(/just sent/)
    expect(orderPayError({ order: order(), userId: 'u1', payments: [old], now })).toBeNull()
    expect(orderPayError({ order: order(), userId: 'u1', payments: [failed], now })).toBeNull()
  })
})

describe('requestStkPush', () => {
  const cfg = {
    MPESA_ENV: 'production', MPESA_CONSUMER_KEY: 'k', MPESA_CONSUMER_SECRET: 's',
    MPESA_SHORTCODE: '6737679', MPESA_PASSKEY: 'pk', MPESA_TRANSACTION_TYPE: 'CustomerBuyGoodsOnline',
    MPESA_PARTY_B: '4132172',
  }
  const run = (stkResponse) => {
    const calls = []
    const fetchImpl = vi.fn(async (url, opts) => {
      calls.push({ url, opts })
      if (String(url).includes('/oauth/')) return new Response('{"access_token":"tok"}', { status: 200 })
      return new Response(JSON.stringify(stkResponse), { status: 200 })
    })
    return requestStkPush({
      cfg, amount: 3800, phone: '254712345678', reference: 'NATAKA-SHOP-ABC123',
      description: 'Shop order', callbackUrl: 'https://x.test/cb', fetchImpl,
    }).then((r) => ({ r, calls }))
  }

  it('sends the Till settings, the order amount and the callback address', async () => {
    const { r, calls } = await run({ ResponseCode: '0', CheckoutRequestID: 'ws_1' })
    expect(r.ok).toBe(true)
    expect(calls[0].url).toContain('https://api.safaricom.co.ke/')
    const body = JSON.parse(calls[1].opts.body)
    expect(body).toMatchObject({
      BusinessShortCode: '6737679', PartyB: '4132172', Amount: 3800, PartyA: '254712345678',
      TransactionType: 'CustomerBuyGoodsOnline', CallBackURL: 'https://x.test/cb',
    })
  })

  it('reports a rejection from Safaricom', async () => {
    const { r } = await run({ ResponseCode: '1', errorMessage: 'nope' })
    expect(r.ok).toBe(false)
  })

  it('throws when Safaricom refuses the credentials', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"errorMessage":"bad"}', { status: 400 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      requestStkPush({ cfg, amount: 1, phone: '254712345678', reference: 'r', description: 'd', callbackUrl: 'u', fetchImpl }),
    ).rejects.toThrow('Daraja auth failed (400)')
  })
})

describe('buildOrderEmails', () => {
  const ctx = {
    order: {
      customer_name: 'Amina Hassan', customer_phone: '254712345678', fulfilment: 'delivery',
      delivery_address: 'Beach Road, <Diani>', handover_note: null, delivery_fee: 300, total: 3800,
    },
    items: [
      { name: 'Kikoy cloth', unit_price: 1500, quantity: 2 },
      { name: 'Sisal basket', unit_price: 500, quantity: 1 },
    ],
    business: { name: 'Nataka Holidays', phone: '0700 000 000', email: 'hi@natakaholidays.co.ke' },
  }
  const [guest, admin] = buildOrderEmails(ctx, { siteUrl: 'https://natakaholidays.co.ke', receipt: 'RCP123' })

  it('gives the guest a receipt with items, fee, total, receipt number and where it goes', () => {
    expect(guest.to).toBe('guest')
    expect(guest.html).toContain('2 × Kikoy cloth')
    expect(guest.html).toContain('KSh 3,000')
    expect(guest.html).toContain('Delivery fee')
    expect(guest.html).toContain('KSh 3,800')
    expect(guest.html).toContain('RCP123')
  })
  it('escapes what customers typed', () => {
    expect(guest.html).toContain('Beach Road, &lt;Diani&gt;')
    expect(guest.html).not.toContain('<Diani>')
  })
  it('alerts the admin with the customer phone', () => {
    expect(admin.to).toBe('admin')
    expect(admin.subject).toContain('Amina Hassan')
    expect(admin.html).toContain('254712345678')
  })
  it('shows the discount line only when a code was used', () => {
    const [withCode] = buildOrderEmails({ ...ctx, order: { ...ctx.order, discount_code: 'WELCOME10', discount_amount: 400 } }, { siteUrl: 'https://x.test' })
    expect(withCode.html).toContain('Discount (WELCOME10)')
    expect(withCode.html).toContain('KSh 400')
    expect(guest.html).not.toContain('Discount (')
  })
  it('shows the gift wrap and message only when chosen', () => {
    const [withWrap] = buildOrderEmails({ ...ctx, order: { ...ctx.order, gift_wrap: true, gift_wrap_fee: 250, gift_message: 'Happy birthday!' } }, { siteUrl: 'https://x.test' })
    expect(withWrap.html).toContain('Gift wrap')
    expect(withWrap.html).toContain('KSh 250')
    expect(withWrap.html).toContain('Happy birthday!')
    expect(guest.html).not.toContain('Gift wrap')
  })
  it('uses the hand-over note for hand-over orders', () => {
    const [g] = buildOrderEmails({ ...ctx, order: { ...ctx.order, fulfilment: 'handover', handover_note: 'Beach Villa', delivery_fee: 0 } }, { siteUrl: 'https://x.test' })
    expect(g.html).toContain('Hand-over at')
    expect(g.html).toContain('Beach Villa')
    expect(g.html).not.toContain('Delivery fee')
  })
})


describe('buildLowStockEmail', () => {
  const business = { name: 'Nataka Holidays', phone: '0700 000 000', email: 'hi@natakaholidays.co.ke' }

  it('sends nothing when nothing is low', () => {
    expect(buildLowStockEmail({ threshold: 2, items: [], business })).toBeNull()
  })
  it('names a single item in the subject', () => {
    const m = buildLowStockEmail({ threshold: 2, items: [{ name: 'Kikoy cloth', option: 'Blue', stock: 1 }], business }, { siteUrl: 'https://x.test' })
    expect(m.to).toBe('admin')
    expect(m.subject).toBe('Low stock: Kikoy cloth (Blue) (1 left)')
  })
  it('counts several items and how many are sold out', () => {
    const m = buildLowStockEmail(
      { threshold: 2, items: [{ name: 'Sisal basket', option: null, stock: 0 }, { name: 'Kikoy cloth', option: 'Red', stock: 2 }], business },
      { siteUrl: 'https://natakaholidays.co.ke' },
    )
    expect(m.subject).toBe('Low stock: 2 shop items need restocking (1 sold out)')
    expect(m.html).toContain('Sisal basket')
    expect(m.html).toContain('Sold out')
    expect(m.html).toContain('Kikoy cloth (Red)')
    expect(m.html).toContain('2 left')
    expect(m.html).toContain('https://natakaholidays.co.ke/admin/products')
    expect(m.text).toContain('Sisal basket: Sold out')
  })
  it('escapes product names', () => {
    const m = buildLowStockEmail({ threshold: 2, items: [{ name: '<b>Bold</b>', option: null, stock: 1 }], business }, { siteUrl: 'https://x.test' })
    expect(m.html).toContain('&lt;b&gt;Bold&lt;/b&gt;')
    expect(m.html).not.toContain('<b>Bold</b>')
  })
})


describe('buildBackInStockEmail', () => {
  const business = { name: 'Nataka Holidays', phone: '0700 000 000', email: 'hi@natakaholidays.co.ke' }

  it('sends nothing without items', () => {
    expect(buildBackInStockEmail({ name: 'Amina', items: [] }, business)).toBeNull()
  })
  it('names one item and links to its page', () => {
    const m = buildBackInStockEmail({ name: 'Amina Hassan', items: [{ name: 'Kikoy cloth', option: 'Blue', slug: 'kikoy', stock: 3 }] }, business, { siteUrl: 'https://natakaholidays.co.ke/' })
    expect(m.subject).toBe('Back in stock: Kikoy cloth (Blue)')
    expect(m.html).toContain('Hello Amina')
    expect(m.html).toContain('href="https://natakaholidays.co.ke/shop/kikoy"')
    expect(m.text).toContain('Kikoy cloth (Blue): https://natakaholidays.co.ke/shop/kikoy')
  })
  it('lists several items in one e-mail', () => {
    const m = buildBackInStockEmail(
      { name: '', items: [{ name: 'A', option: null, slug: 'a', stock: 1 }, { name: 'B', option: null, slug: 'b', stock: 2 }] },
      business,
      { siteUrl: 'https://x.test' },
    )
    expect(m.subject).toBe('2 items you wanted are back in stock')
    expect(m.html).toContain('/shop/a')
    expect(m.html).toContain('/shop/b')
    expect(m.html).not.toContain('Hello ')
  })
  it('escapes names', () => {
    const m = buildBackInStockEmail({ name: '<i>x</i>', items: [{ name: '<b>Bold</b>', option: null, slug: 'b', stock: 1 }] }, business, { siteUrl: 'https://x.test' })
    expect(m.html).not.toContain('<b>Bold</b>')
    expect(m.html).not.toContain('<i>x</i>')
  })
})

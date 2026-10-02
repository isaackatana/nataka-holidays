import { describe, expect, it } from 'vitest'
import { buildGuestStatusMessage, buildGuestWhatsAppLink, normalizeKenyanPhone } from './phone'

describe('normalizeKenyanPhone', () => {
  it('accepts common Kenyan formats', () => {
    for (const input of ['0712 345 678', '+254 712 345 678', '254712345678', '712345678']) {
      expect(normalizeKenyanPhone(input)).toBe('254712345678')
    }
  })
  it('rejects other numbers', () => {
    for (const input of ['', null, '12345', '0812345678', '+1 415 555 0100']) {
      expect(normalizeKenyanPhone(input)).toBeNull()
    }
  })
})

describe('guest WhatsApp helpers', () => {
  it('builds a wa.me link for a valid number and null otherwise', () => {
    expect(buildGuestWhatsAppLink('0712345678', 'Hi there')).toBe('https://wa.me/254712345678?text=Hi%20there')
    expect(buildGuestWhatsAppLink('+44 20 7946 0000', 'Hi')).toBeNull()
  })

  it('writes a status-specific message using the first name', () => {
    const base = { guestName: 'Amina Hassan', propertyTitle: 'Beach Villa', dates: '1–4 Nov' }
    expect(buildGuestStatusMessage({ ...base, status: 'confirmed' })).toMatch(/^Hello Amina, .*confirmed/)
    expect(buildGuestStatusMessage({ ...base, status: 'cancelled' })).toMatch(/cancelled/)
    expect(buildGuestStatusMessage({ ...base, status: 'pending', propertyTitle: null })).toMatch(/your stay/)
  })
})

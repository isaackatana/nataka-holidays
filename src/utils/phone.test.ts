import { describe, expect, it } from 'vitest'
import {
  buildExperienceRequestMessage,
  buildGuestStatusMessage,
  buildGuestWhatsAppLink,
  normalizeKenyanPhone,
} from './phone'

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

describe('buildExperienceRequestMessage', () => {
  const base = { guestName: 'Amina Kamau', experienceTitle: 'Dhow Trip', date: 'Tue, 1 Dec 2026', people: 3 }

  it('greets by first name and describes the request', () => {
    const msg = buildExperienceRequestMessage({ ...base, status: 'confirmed' })
    expect(msg).toContain('Hello Amina')
    expect(msg).toContain('Dhow Trip on Tue, 1 Dec 2026 for 3 people')
    expect(msg).toContain('confirmed')
  })

  it('asks about another date when declined', () => {
    expect(buildExperienceRequestMessage({ ...base, status: 'declined' })).toContain('another date')
  })

  it('uses the singular for one person', () => {
    expect(buildExperienceRequestMessage({ ...base, people: 1, status: 'new' })).toContain('1 person')
  })
})

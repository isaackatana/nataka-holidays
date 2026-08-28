import { describe, it, expect } from 'vitest'
import { buildTripRequestMessage } from './buildTripRequestMessage'

describe('buildTripRequestMessage', () => {
  it('includes properties with their nightly price', () => {
    const message = buildTripRequestMessage({
      properties: [{ id: '1', title: 'Azure Reef Villa', slug: 'azure-reef-villa', price_per_night: 45000 }],
      experiences: [],
    })
    expect(message).toContain('Azure Reef Villa')
    expect(message).toContain('/night')
    expect(message).toContain('45,000') // formatKES output for 45000
  })

  it('includes experiences with their price when set', () => {
    const message = buildTripRequestMessage({
      properties: [],
      experiences: [{ id: '1', title: 'Wasini Island Tour', slug: 'wasini-tour', price: 7500 }],
    })
    expect(message).toContain('Wasini Island Tour')
    expect(message).toContain('7,500')
  })

  it('omits a price suffix for experiences with no price set', () => {
    const message = buildTripRequestMessage({
      properties: [],
      experiences: [{ id: '1', title: 'Mystery Activity', slug: 'mystery', price: null }],
    })
    expect(message).toContain('- Mystery Activity')
    expect(message).not.toContain('- Mystery Activity (')
  })

  it('omits the Stays/Experiences sections entirely when empty, rather than printing empty headers', () => {
    const message = buildTripRequestMessage({ properties: [], experiences: [] })
    expect(message).not.toContain('Stays:')
    expect(message).not.toContain('Experiences:')
  })

  it('includes dates only when both checkIn and checkOut are provided', () => {
    const withBoth = buildTripRequestMessage({
      properties: [],
      experiences: [],
      checkIn: '2026-09-01',
      checkOut: '2026-09-05',
    })
    expect(withBoth).toContain('2026-09-01 to 2026-09-05')

    const withOnlyCheckIn = buildTripRequestMessage({
      properties: [],
      experiences: [],
      checkIn: '2026-09-01',
    })
    expect(withOnlyCheckIn).not.toContain('Dates:')
  })

  it('includes guest count and notes only when provided', () => {
    const withExtras = buildTripRequestMessage({
      properties: [],
      experiences: [],
      guests: 4,
      notes: 'Celebrating an anniversary',
    })
    expect(withExtras).toContain('Guests: 4')
    expect(withExtras).toContain('Celebrating an anniversary')

    const withoutExtras = buildTripRequestMessage({ properties: [], experiences: [] })
    expect(withoutExtras).not.toContain('Guests:')
    expect(withoutExtras).not.toContain('Notes:')
  })

  it('always ends with a call to confirm availability and price, since that is the entire point of this message', () => {
    const message = buildTripRequestMessage({ properties: [], experiences: [] })
    expect(message).toContain('confirm availability')
    expect(message.toLowerCase()).toContain('total price')
  })

  it('includes both stays and experiences together in one message', () => {
    const message = buildTripRequestMessage({
      properties: [{ id: '1', title: 'Baobab Cottage', slug: 'baobab', price_per_night: 12000 }],
      experiences: [{ id: '1', title: 'Snorkeling Trip', slug: 'snorkel', price: 3500 }],
    })
    const stayIndex = message.indexOf('Baobab Cottage')
    const experienceIndex = message.indexOf('Snorkeling Trip')
    expect(stayIndex).toBeGreaterThan(-1)
    expect(experienceIndex).toBeGreaterThan(-1)
  })
})

import { describe, expect, it } from 'vitest'
import { slugify, uniqueSlug } from './slugify'

describe('slugify', () => {
  it('lowercases, strips symbols and hyphenates', () => {
    expect(slugify("  Diani Beach Villa & Spa! ")).toBe('diani-beach-villa-spa')
  })
})

describe('uniqueSlug', () => {
  it('returns the base when it is free', () => {
    expect(uniqueSlug('beach-villa-copy', ['beach-villa'])).toBe('beach-villa-copy')
  })
  it('appends the first free number when taken', () => {
    expect(uniqueSlug('beach-villa', ['beach-villa'])).toBe('beach-villa-2')
    expect(uniqueSlug('beach-villa', ['beach-villa', 'beach-villa-2', 'beach-villa-3'])).toBe('beach-villa-4')
  })
})

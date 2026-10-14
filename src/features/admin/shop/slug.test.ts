import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it.each([
    ['Kikoy Cloth (Blue)', 'kikoy-cloth-blue'],
    ['  Sisal   basket ', 'sisal-basket'],
    ['Café Ya Pwani', 'cafe-ya-pwani'],
    ['Soapstone — bowl #2', 'soapstone-bowl-2'],
  ])('%s -> %s', (input, expected) => expect(slugify(input)).toBe(expected))

  it('only ever produces what the database accepts', () => {
    for (const s of ['!!!', 'a'.repeat(300), 'Ünïcödé']) {
      const out = slugify(s)
      expect(out === '' || /^[a-z0-9-]+$/.test(out)).toBe(true)
      expect(out.length).toBeLessThanOrEqual(100)
    }
  })
})

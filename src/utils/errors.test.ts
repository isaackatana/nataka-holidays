import { describe, expect, it } from 'vitest'
import { errorMessage, isUniqueViolation } from './errors'

describe('errorMessage', () => {
  it('reads Error instances and plain Supabase-style objects', () => {
    expect(errorMessage(new Error('boom'), 'fallback')).toBe('boom')
    expect(errorMessage({ message: 'duplicate key value', code: '23505' }, 'fallback')).toBe('duplicate key value')
  })
  it('falls back for anything else', () => {
    expect(errorMessage(null, 'fallback')).toBe('fallback')
    expect(errorMessage('text', 'fallback')).toBe('fallback')
    expect(errorMessage({ message: '' }, 'fallback')).toBe('fallback')
  })
})

describe('isUniqueViolation', () => {
  it('detects Postgres code 23505 only', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
    expect(isUniqueViolation({ code: '42501' })).toBe(false)
    expect(isUniqueViolation(new Error('x'))).toBe(false)
    expect(isUniqueViolation(undefined)).toBe(false)
  })
})

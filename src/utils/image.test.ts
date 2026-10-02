import { describe, expect, it } from 'vitest'
import { fitWithin, withExtension } from './image'

describe('fitWithin', () => {
  it('shrinks landscape and portrait photos by their longest side', () => {
    expect(fitWithin(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 })
    expect(fitWithin(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 })
  })
  it('never scales up', () => {
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 })
  })
})

describe('withExtension', () => {
  it('replaces or adds an extension', () => {
    expect(withExtension('IMG_1234.JPG', 'webp')).toBe('IMG_1234.webp')
    expect(withExtension('beach.house.png', 'webp')).toBe('beach.house.webp')
    expect(withExtension('noext', 'webp')).toBe('noext.webp')
  })
})

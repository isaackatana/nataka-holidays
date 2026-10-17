import { describe, it, expect } from 'vitest'
import { selectReviewPhotos, MAX_REVIEW_PHOTOS } from './reviewPhotos'

const file = (type: string, size = 1000) => new File([new Uint8Array(size)], 'x', { type })

describe('selectReviewPhotos', () => {
  it('accepts allowed image types', () => {
    const r = selectReviewPhotos(0, [file('image/jpeg'), file('image/png'), file('image/webp')])
    expect(r.accepted).toHaveLength(3)
    expect(r.problem).toBeNull()
  })

  it('rejects non-images and says why', () => {
    const r = selectReviewPhotos(0, [file('application/pdf'), file('image/gif')])
    expect(r.accepted).toHaveLength(0)
    expect(r.problem).toMatch(/JPEG, PNG or WebP/)
  })

  it('rejects huge files', () => {
    const r = selectReviewPhotos(0, [file('image/jpeg', 16 * 1024 * 1024)])
    expect(r.accepted).toHaveLength(0)
    expect(r.problem).toMatch(/too large/)
  })

  it('never goes over the photo limit, counting photos already attached', () => {
    const r = selectReviewPhotos(2, [file('image/jpeg'), file('image/jpeg')])
    expect(r.accepted).toHaveLength(1)
    expect(r.problem).toContain(String(MAX_REVIEW_PHOTOS))
    expect(selectReviewPhotos(3, [file('image/jpeg')]).accepted).toHaveLength(0)
  })
})

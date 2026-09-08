import { describe, it, expect } from 'vitest'
import { parseVideoUrl } from './video'

describe('parseVideoUrl', () => {
  it('returns null for empty/whitespace input', () => {
    expect(parseVideoUrl('')).toBeNull()
    expect(parseVideoUrl('   ')).toBeNull()
  })

  it('returns null for invalid URLs', () => {
    expect(parseVideoUrl('not a url')).toBeNull()
    expect(parseVideoUrl('just-some-text')).toBeNull()
  })

  it('parses a standard YouTube watch URL', () => {
    const result = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(result).toEqual({ kind: 'youtube', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' })
  })

  it('parses a YouTube watch URL without www', () => {
    const result = parseVideoUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')
    expect(result?.kind).toBe('youtube')
    expect(result?.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('parses a youtu.be short link', () => {
    const result = parseVideoUrl('https://youtu.be/dQw4w9WgXcQ')
    expect(result).toEqual({ kind: 'youtube', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' })
  })

  it('parses an already-correct YouTube embed URL', () => {
    const result = parseVideoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(result).toEqual({ kind: 'youtube', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' })
  })

  it('parses a YouTube watch URL with extra query params (e.g. a timestamp)', () => {
    const result = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')
    expect(result?.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('parses a standard Vimeo URL', () => {
    const result = parseVideoUrl('https://vimeo.com/123456789')
    expect(result).toEqual({ kind: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456789' })
  })

  it('parses an already-correct Vimeo player embed URL', () => {
    const result = parseVideoUrl('https://player.vimeo.com/video/123456789')
    expect(result).toEqual({ kind: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456789' })
  })

  it('does not misidentify a Vimeo URL with a non-numeric path as a valid video id', () => {
    const result = parseVideoUrl('https://vimeo.com/watch')
    // Falls through to 'direct' rather than producing a broken embed URL
    // with a non-numeric id, since /watch isn't a real Vimeo video id.
    expect(result?.kind).toBe('direct')
  })

  it('treats a direct video file URL as "direct", not youtube/vimeo', () => {
    const result = parseVideoUrl('https://example.supabase.co/storage/v1/object/public/videos/tour.mp4')
    expect(result).toEqual({
      kind: 'direct',
      embedUrl: 'https://example.supabase.co/storage/v1/object/public/videos/tour.mp4',
    })
  })

  it('treats an arbitrary CDN URL as "direct"', () => {
    const result = parseVideoUrl('https://cdn.example.com/hero-background.mp4')
    expect(result?.kind).toBe('direct')
    expect(result?.embedUrl).toBe('https://cdn.example.com/hero-background.mp4')
  })

  it('trims surrounding whitespace before parsing', () => {
    const result = parseVideoUrl('  https://youtu.be/dQw4w9WgXcQ  ')
    expect(result?.kind).toBe('youtube')
  })
})

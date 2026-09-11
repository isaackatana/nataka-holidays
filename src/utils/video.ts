export type VideoKind = 'youtube' | 'vimeo' | 'direct'

export interface ParsedVideo {
  kind: VideoKind
  /** For 'youtube'/'vimeo': the iframe embed src. For 'direct': the
   * original URL, used directly as a <video> element's src. */
  embedUrl: string
}

/**
 * Accepts whatever format someone might reasonably paste — a full watch
 * URL, a share URL, a youtu.be short link, an already-correct embed URL
 * — and normalizes it to an embeddable form. Falls back to 'direct'
 * (rendered as a native <video> element) for anything that doesn't match
 * a known YouTube/Vimeo pattern, which also covers a directly-hosted
 * .mp4/.webm file URL.
 */
export function parseVideoUrl(url: string): ParsedVideo | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  // new URL() happily parses `javascript:...`, `data:...`, `vbscript:...`,
  // `file:...` etc. as syntactically valid — none of those should ever
  // reach a <video src> or iframe src, regardless of how a given browser
  // currently handles those schemes in a media/iframe context. Reject
  // anything that isn't a normal web URL before it gets anywhere near
  // rendering, the same way an unparseable URL is rejected above.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

  const host = parsed.hostname.replace(/^www\./, '')

  // youtube.com/watch?v=ID, youtube.com/embed/ID, youtu.be/ID
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = parsed.pathname.startsWith('/embed/')
      ? parsed.pathname.split('/embed/')[1]
      : parsed.searchParams.get('v')
    if (id) {
      return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` }
    }
  }
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1)
    if (id) {
      return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` }
    }
  }

  // vimeo.com/ID, player.vimeo.com/video/ID
  if (host === 'vimeo.com') {
    const id = parsed.pathname.split('/').filter(Boolean)[0]
    if (id && /^\d+$/.test(id)) {
      return { kind: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` }
    }
  }
  if (host === 'player.vimeo.com') {
    return { kind: 'vimeo', embedUrl: trimmed }
  }

  // Anything else — treat as a direct video file URL (Supabase Storage,
  // any CDN, etc.) and let a native <video> element handle it.
  return { kind: 'direct', embedUrl: trimmed }
}

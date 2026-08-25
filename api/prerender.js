// Vercel serverless function (Node.js runtime by default for .js under /api).
//
// WHY THIS EXISTS: this is a client-rendered SPA (see the architecture
// doc §1 and src/components/shared/SEO.tsx). react-helmet-async sets
// <title>/OG tags correctly, but only after the page's JS runs — fine for
// Googlebot (which renders JS), not fine for WhatsApp, Facebook, Twitter,
// etc., whose link-preview crawlers fetch raw HTML and never execute
// JavaScript. Without this, sharing a /stays/:slug link on WhatsApp would
// show a generic/blank preview instead of the property's photo and title.
//
// HOW IT'S REACHED: vercel.json rewrites requests to /stays/:slug and
// /experiences/:slug to this function, but ONLY when the request's
// User-Agent matches a known non-JS-executing crawler (see the `has`
// condition there). Regular visitors never hit this function — they get
// the normal SPA via the catch-all rewrite to /index.html.
//
// FAILURE MODE: any error here (bad slug, Supabase unreachable, etc.)
// falls back to generic site-wide meta tags rather than a 500 — a
// mediocre link preview is a much better outcome than a broken one for
// a page that's actively being shared right now.
import { createClient } from '@supabase/supabase-js'

// See scripts/generate-sitemap.mjs for why this reads an env var instead
// of self-detecting like the browser-side src/utils/siteUrl.ts does —
// this runs in Node with no window.location. Set SITE_URL in Vercel's
// project settings once the real domain is live.
const SITE_URL = process.env.SITE_URL || 'https://natakaholidays.com'
const SITE_NAME = 'Nataka Holidays'
const DEFAULT_DESCRIPTION =
  'Premium villas, apartments and beach houses in Diani Beach, Kenya.'

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderHtml({ title, description, image, url }) {
  const fullTitle = `${escapeHtml(title)} | ${SITE_NAME}`
  const desc = escapeHtml(description)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${fullTitle}</title>
<meta name="description" content="${desc}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${fullTitle}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(url)}" />
${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${fullTitle}" />
<meta name="twitter:description" content="${desc}" />
${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}
<meta http-equiv="refresh" content="0; url=${escapeHtml(url)}" />
</head>
<body>
<p>${fullTitle} — <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
</body>
</html>`
}

export default async function handler(req, res) {
  const { type, slug } = req.query
  const url = `${SITE_URL}${type === 'experience' ? '/experiences' : '/stays'}/${slug ?? ''}`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Crawlers re-fetch link previews periodically; a short cache avoids
  // hitting Supabase on every single crawl without serving stale data
  // for long if a title/photo changes.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey || !slug) {
    res.status(200).send(renderHtml({ title: SITE_NAME, description: DEFAULT_DESCRIPTION, url }))
    return
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    if (type === 'experience') {
      const { data } = await supabase
        .from('experiences')
        .select('title, description, experience_images ( storage_path )')
        .eq('slug', slug)
        .eq('is_published', true)
        .single()

      if (!data) {
        res.status(200).send(renderHtml({ title: SITE_NAME, description: DEFAULT_DESCRIPTION, url }))
        return
      }

      const imagePath = data.experience_images?.[0]?.storage_path
      const image = imagePath
        ? supabase.storage.from('experience-images').getPublicUrl(imagePath).data.publicUrl
        : undefined

      res.status(200).send(
        renderHtml({
          title: data.title,
          description: data.description?.slice(0, 200) ?? DEFAULT_DESCRIPTION,
          image,
          url,
        }),
      )
      return
    }

    // type === 'property' (default)
    const { data } = await supabase
      .from('properties')
      .select('title, description, property_images ( storage_path, is_primary )')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (!data) {
      res.status(200).send(renderHtml({ title: SITE_NAME, description: DEFAULT_DESCRIPTION, url }))
      return
    }

    const images = data.property_images ?? []
    const primaryPath = (images.find((i) => i.is_primary) ?? images[0])?.storage_path
    const image = primaryPath
      ? supabase.storage.from('property-images').getPublicUrl(primaryPath).data.publicUrl
      : undefined

    res.status(200).send(
      renderHtml({
        title: data.title,
        description: data.description?.slice(0, 200) ?? DEFAULT_DESCRIPTION,
        image,
        url,
      }),
    )
  } catch (err) {
    console.error('[prerender] Failed, falling back to generic meta:', err)
    res.status(200).send(renderHtml({ title: SITE_NAME, description: DEFAULT_DESCRIPTION, url }))
  }
}

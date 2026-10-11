import { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { SITE_ORIGIN } from '@/utils/siteUrl'

interface SEOProps {
  title: string
  description: string
  image?: string
  /** Path only (e.g. "/stays/azure-reef-villa-diani"), not a full URL —
   * SEO builds the canonical/OG URL from this + the site's own origin, so
   * callers don't each need to know or hardcode the domain. */
  path?: string
  type?: 'website' | 'article'
  /** Pages behind auth (favorites, my-bookings, profile, all of /admin)
   * should never be indexed — search results linking to a page that just
   * redirects to /login serve no one. */
  noindex?: boolean
}

/** Per-page title/description/OG tags via react-helmet-async — sets these
 * correctly for JS-executing crawlers (Googlebot) and regular browsers.
 * Non-JS-executing social crawlers (WhatsApp, Facebook, Twitter, etc.)
 * never run this — they're served by api/prerender.js instead, routed
 * there by vercel.json based on User-Agent. See supabase/README.md and
 * that file's own comments for how the two fit together. */
export function SEO({ title, description, image, path, type = 'website', noindex }: SEOProps) {
  const fullTitle = `${title} | Nataka Holidays`
  const url = path ? `${SITE_ORIGIN}${path}` : undefined
  // Pages without their own photo still get the site-wide image, as an
  // absolute URL (relative ones are ignored by link-preview crawlers).
  const ogImage = image ?? `${SITE_ORIGIN}/og-default.jpg`

  // index.html ships generic default tags for crawlers that don't run JS.
  // Helmet only adds its own tags beside them, leaving two of each (and
  // anything that reads the first match shows the generic one), so drop the
  // defaults once a page has its own.
  useEffect(() => {
    document.head.querySelectorAll('[data-default-seo]').forEach((el) => el.remove())
  }, [])

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {url && <link rel="canonical" href={url} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      {url && <meta property="og:url" content={url} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  )
}

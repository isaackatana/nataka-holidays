/**
 * The site's own origin (e.g. "https://natakaholidays.com"), used to
 * build absolute canonical/OG URLs and JSON-LD `url` fields.
 *
 * Deliberately reads window.location.origin rather than a hardcoded
 * domain string. A hardcoded value would be wrong on Vercel preview
 * deployments (each gets its own *.vercel.app URL) and in local dev, and
 * would need updating in code the moment the real domain changes.
 * window.location.origin is always correct for wherever the page is
 * actually being served from, with zero configuration.
 *
 * Only usable in the browser (not in scripts/generate-sitemap.mjs or
 * api/prerender.js, which run in Node with no `window` — those use their
 * own SITE_URL env var instead, since a sitemap/crawler-facing response
 * genuinely needs one canonical, explicitly-configured domain rather than
 * "whatever origin happened to make this request").
 */
export const SITE_ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

// Generates public/sitemap.xml from live Supabase data before every build.
// Run automatically via the "prebuild" npm script — Vite then copies
// public/* into dist/ as normal, so no separate deploy step is needed.
//
// Deliberately fails soft, not hard: if Supabase env vars aren't set (e.g.
// running `npm run build` locally without a connected project, or in any
// environment where hitting a real database isn't appropriate) this
// script logs a warning and writes a sitemap containing just the static
// pages, rather than crashing the whole build over a missing .env.local.
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(__dirname, '..', 'public', 'sitemap.xml')

// The real domain, used to build absolute URLs in the sitemap. Node has
// no `window.location` (unlike the browser-side src/utils/siteUrl.ts), so
// this can't self-detect the origin — it needs an explicit value. Reads
// from the SITE_URL env var (set this in Vercel's project settings
// alongside the Supabase vars) and falls back to a placeholder if unset,
// so a local build without it configured still produces a valid sitemap
// rather than failing outright.
const SITE_URL = process.env.SITE_URL || 'https://natakaholidays.com'
if (!process.env.SITE_URL) {
  console.warn(
    `[sitemap] SITE_URL env var not set — using placeholder "${SITE_URL}". ` +
      'Set SITE_URL in Vercel project settings once the real domain is live.',
  )
}

const STATIC_PATHS = [
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/holiday-homes', changefreq: 'daily', priority: 0.9 },
  { path: '/experiences', changefreq: 'weekly', priority: 0.7 },
  { path: '/transport', changefreq: 'monthly', priority: 0.5 },
  { path: '/about', changefreq: 'monthly', priority: 0.4 },
  { path: '/contact', changefreq: 'monthly', priority: 0.4 },
]

function urlEntry(path, lastmod, changefreq, priority) {
  return [
    '  <url>',
    `    <loc>${SITE_URL}${path}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n')
}

async function main() {
  const entries = STATIC_PATHS.map((p) => urlEntry(p.path, null, p.changefreq, p.priority))

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[sitemap] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — writing a sitemap with ' +
        'static pages only. Property and experience URLs will be added automatically once this ' +
        'runs with real Supabase credentials (e.g. in the Vercel build environment).',
    )
  } else {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('slug, updated_at')
      .eq('is_published', true)

    if (propertiesError) {
      console.warn('[sitemap] Failed to fetch properties, continuing without them:', propertiesError.message)
    } else {
      for (const p of properties ?? []) {
        entries.push(urlEntry(`/stays/${p.slug}`, p.updated_at?.slice(0, 10), 'weekly', 0.8))
      }
    }

    const { data: experiences, error: experiencesError } = await supabase
      .from('experiences')
      .select('slug, updated_at')
      .eq('is_published', true)

    if (experiencesError) {
      console.warn('[sitemap] Failed to fetch experiences, continuing without them:', experiencesError.message)
    } else {
      for (const e of experiences ?? []) {
        entries.push(urlEntry(`/experiences/${e.slug}`, e.updated_at?.slice(0, 10), 'monthly', 0.6))
      }
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')

  writeFileSync(OUTPUT_PATH, xml)
  console.log(`[sitemap] Wrote ${entries.length} URLs to public/sitemap.xml`)
}

main().catch((err) => {
  // Same soft-fail philosophy as the missing-env-var case above: a
  // sitemap problem shouldn't be able to take down the whole site build.
  console.error('[sitemap] Failed to generate sitemap, continuing build without updating it:', err)
})

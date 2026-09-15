import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/**
 * Rewrites the relative image paths in index.html's og:image /
 * twitter:image tags to absolute URLs at build time.
 *
 * Social scrapers (Facebook, WhatsApp, LinkedIn, X) require absolute
 * URLs for preview images — a relative path like "/og-default.jpg" is
 * commonly ignored outright, which shows up as a preview with no image.
 * index.html is a static file with no templating, so this does the
 * substitution during the build.
 *
 * Reads the same SITE_URL env var as scripts/generate-sitemap.mjs and
 * api/prerender.js (not a VITE_-prefixed one, since this runs at build
 * time in Node and shouldn't be exposed to the client bundle), keeping
 * one source of truth for the deployed domain.
 */
function absoluteSocialImages(): Plugin {
  const siteUrl = process.env.SITE_URL || 'https://natakaholidays.co.ke'
  return {
    name: 'absolute-social-images',
    transformIndexHtml(html) {
      return html.replace(
        /(<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content=")(\/[^"]*)(")/g,
        (_match, before, relativePath, after) => `${before}${siteUrl}${relativePath}${after}`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), absoluteSocialImages()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})

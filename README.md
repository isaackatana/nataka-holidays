# Nataka Holidays

Full-stack holiday rental platform for Diani Beach & the Kenyan Coast.
React + TypeScript + Vite + Tailwind CSS v4 + Supabase, deployed on Vercel.

## Status

The full application is built: public site (home, listings with filters,
property details, experiences, about, contact), customer accounts
(favorites, bookings, profile), and the complete admin dashboard
(properties + image upload, bookings, customers, reviews, experiences +
image upload, settings). `npm run build` and `npm run lint` both pass.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase credentials — see supabase/README.md
npm run dev
```

## Scripts

- `npm run dev` — local dev server
- `npm run build` — regenerates `public/sitemap.xml`, then type-checks (`tsc -b`) and builds
- `npm run sitemap` — regenerate `public/sitemap.xml` on its own
- `npm run lint` — oxlint
- `npm run test` — Vitest, currently covering:
  - `useDialogA11y` — Escape-to-close/focus-management behind the mobile
    nav menus and the filter drawer
  - `useSwipeToToggle` — swipe-to-open/swipe-to-close gesture behind
    those same drawers (edge-zone detection, direction, and the
    horizontal-vs-vertical scroll distinction)
  
  Both hooks look simple but hide real re-render/stale-closure traps that
  pass on casual inspection and only surface under a real test — worth
  running (`npm run test`) after touching either file.
- `npm run preview` — preview the production build locally

## SEO

- `src/components/shared/SEO.tsx` — per-page `<title>`/description/OG/canonical
  tags via `react-helmet-async`.
- `src/components/shared/JsonLd.tsx` — schema.org structured data
  (`LodgingBusiness` on property pages, `TouristTrip` on experience pages,
  `Organization` on the homepage) for richer search results.
- `scripts/generate-sitemap.mjs` — runs automatically before every build
  (`prebuild` script). Queries Supabase for all published properties and
  experiences and writes `public/sitemap.xml`. Fails soft: if Supabase
  credentials aren't available (e.g. building locally without
  `.env.local`), it writes a sitemap with just the static pages instead
  of failing the build.
- `api/prerender.js` + `vercel.json` — this is a client-rendered SPA, so
  `react-helmet-async`'s OG tags only exist after the page's JS runs.
  That's fine for Googlebot (which renders JS) but not for WhatsApp,
  Facebook, Twitter, etc., whose link-preview crawlers read raw HTML and
  never execute JavaScript — without this, sharing a property link on
  WhatsApp would show a blank/generic preview. `vercel.json` rewrites
  `/stays/:slug` and `/experiences/:slug` to `api/prerender.js`, but
  **only** when the request's `User-Agent` matches a known non-JS
  crawler; everything else still gets the normal SPA. The function
  fetches the real title/description/photo from Supabase and returns
  lightweight static HTML with correct meta tags. On any error (bad
  slug, Supabase unreachable) it falls back to generic site-wide meta
  rather than a broken response — this endpoint answers live link shares,
  so a mediocre preview beats an error.
  **Note:** the Supabase env vars need to be set in the Vercel project's
  environment variables (not just locally in `.env.local`) for both the
  Vite build and this serverless function to work once deployed.

## Deployment

See `DEPLOYMENT.md` for the full Vercel checklist — environment
variables, build settings, and a post-deploy verification list (including
how to check social link previews, which can't be tested locally).

## Architecture

See the accompanying `nataka-holiday-homes-architecture.md` document for
the full folder structure rationale, database schema, and RLS policy plan.

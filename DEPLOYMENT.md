# Deployment checklist — Vercel

This assumes the Supabase side (project, schema, RLS, storage buckets) is
already done per `supabase/README.md`. This checklist is just the Vercel
half.

## 1. Connect the repository

1. Push this project to a Git repo (GitHub/GitLab/Bitbucket).
2. In Vercel: **New Project** → import that repo.
3. Vercel should auto-detect the **Vite** framework preset. If it doesn't,
   set manually:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`

## 2. Environment variables

Set these in **Vercel → Project Settings → Environment Variables**. Add
each to **Production**, **Preview**, and **Development** unless noted —
Preview deployments (PRs, branches) need real values too or the build
either fails (missing Supabase vars → the app throws at load, see
`src/lib/supabase.ts`) or silently degrades (missing `SITE_URL` → sitemap
and social previews fall back to a placeholder domain).

| Variable | Where it's used | Required? |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser app, `scripts/generate-sitemap.mjs`, `api/prerender.js` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Same as above | Yes |
| `VITE_WHATSAPP_NUMBER` | Browser app (wa.me links) | Yes, or every WhatsApp button links nowhere useful |
| `SITE_URL` | `scripts/generate-sitemap.mjs`, `api/prerender.js` | Recommended — falls back to a placeholder domain if unset |

Never add `SUPABASE_SERVICE_ROLE_KEY` here or anywhere in this project —
nothing in this codebase needs it, and it would bypass every RLS policy
if it ever leaked into client code.

## 3. First deploy

Deploy once environment variables are set. Then, using the deployed URL:

1. **Sign up** through the app, then promote yourself to admin via SQL
   (see `supabase/README.md` §5) — there's no other way to get the first
   admin account, by design.
2. Confirm `/admin` loads for that account and redirects everyone else.
3. **Create a property** in the admin, add photos, publish it.
4. Confirm it shows up on `/holiday-homes` and at its `/stays/:slug` URL.
5. Submit a booking enquiry as a guest (logged out) and as a logged-in
   customer; confirm both appear in `/admin/bookings`.
6. Check `https://<your-domain>/sitemap.xml` — it should list the
   property you just published, not just the static pages. If it only
   shows static pages, double-check `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` are set for the environment that ran the
   build (Production vs Preview use separate env var sets in Vercel).

## 4. Verify social link previews

This is the one piece of `api/prerender.js` that can't be verified until
it's actually deployed (see that file's comments for why it exists) — it
depends on real Vercel routing + a real crawler request, neither of which
exist in a local dev environment.

1. Copy a real `/stays/:slug` URL from your deployed site.
2. Test it in:
   - [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
   - [Twitter Card Validator](https://cards-dev.twitter.com/validator)
   - Or just paste the link into an actual WhatsApp chat to yourself.
3. Confirm the property's real title and photo show up, not a blank or
   generic preview. If Facebook's debugger shows a *stale* preview after
   you've since changed the property, use its "Scrape Again" button —
   Facebook caches previews independently of the `Cache-Control` header
   `api/prerender.js` sets.

## 5. Custom domain

Once a real domain is attached in Vercel:

1. Update the `SITE_URL` env var to match (all environments that should
   use it — typically just Production).
2. Update `public/robots.txt`'s `Sitemap:` line to match — that one file
   isn't generated dynamically, unlike `sitemap.xml` itself.
3. Redeploy so `scripts/generate-sitemap.mjs` (runs in `prebuild`) picks
   up the new `SITE_URL`.

## Troubleshooting

**"Something went wrong loading properties" (or a similar generic error
card) on a page that used to work.** As of this build, every failed
query and mutation is logged to the browser console with its query key
and the real underlying error (`src/lib/queryClient.ts`) — open dev
tools and check there first; the on-screen message is deliberately
generic and doesn't show it.

The most common real cause: a **migration that hasn't been applied yet**
to your Supabase project. Whenever a new column is added to the schema
in this codebase (check `supabase/migrations/` for the highest-numbered
file), the code that queries it ships in the same commit — if you pull
new code before running the matching migration, every query touching
that column fails with something like `column properties.video_url
does not exist`, which is exactly what the console will show. Run
`supabase db push` (or paste the missing migration's SQL into the
Dashboard's SQL Editor) and reload.

Other causes that produce the same generic message: `VITE_SUPABASE_URL`
/ `VITE_SUPABASE_ANON_KEY` pointing at the wrong project, an expired or
revoked anon key, or an RLS policy blocking the read — the console error
will distinguish between these immediately.

## Known gaps at time of writing

- No online payment (by design — see the original spec's BOOKING SYSTEM
  section). Booking enquiries are the whole flow for now; M-Pesa/Stripe
  would be a genuinely new feature, not a bug fix.

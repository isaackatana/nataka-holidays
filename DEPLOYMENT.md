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
fails (missing Supabase vars → the app throws at load, see
`src/lib/supabase.ts`).

| Variable | Where it's used | Required? |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser app, `scripts/generate-sitemap.mjs`, `api/prerender.js` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Same as above | Yes |
| `VITE_WHATSAPP_NUMBER` | Browser app (wa.me links) | Yes, or every WhatsApp button links nowhere useful |
| `SITE_URL` | `scripts/generate-sitemap.mjs`, `api/prerender.js`, `vite.config.ts` | Optional — defaults to `https://natakaholidays.co.ke`, the real registered domain. Set it only to override (e.g. a staging domain). |

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

The site's domain — `natakaholidays.co.ke` — is already configured
throughout the codebase (the `SITE_URL` fallback in
`scripts/generate-sitemap.mjs`, `api/prerender.js` and `vite.config.ts`,
plus `public/robots.txt`'s `Sitemap:` line). Nothing in the code needs
changing; you just need to attach it in Vercel:

1. **Vercel → Project Settings → Domains → Add** `natakaholidays.co.ke`
   (and `www.natakaholidays.co.ke` if you want it, with one redirecting
   to the other — pick one as canonical so search engines don't treat
   them as two separate sites).
2. Add the DNS records Vercel shows you at your `.co.ke` registrar.
   DNS propagation usually takes minutes but can take up to 48 hours.
3. Redeploy once the domain resolves, so `sitemap.xml` regenerates and
   Google sees the final URLs.

**If you ever serve the site from a different domain** (a staging
environment, say), set the `SITE_URL` env var in that environment to
override the default — and update `public/robots.txt`'s `Sitemap:` line,
which is a static file rather than generated.

## 6. M-Pesa payments (STK Push)

Admins send a payment prompt to a guest's phone from **Admin → Bookings →
expand a booking → M-Pesa payments**. The guest enters their PIN, and the
payment shows as Paid within seconds. Guests see the paid amount on
*My bookings*.

**One-time setup**

1. Run migrations `0008_payments.sql` and `0009_customer_payments.sql` on Supabase (then `0010_availability_sync.sql` §7 and `0011_notifications.sql` §8).
2. Create an app at <https://developer.safaricom.co.ke> and get the
   consumer key/secret. For testing, use the sandbox shortcode `174379`
   and the public sandbox passkey shown on the Daraja "Simulate" page.
3. Generate a long random string (e.g. `openssl rand -hex 32`). This is
   your callback secret. Store it in **both** places:
   - Vercel env var `MPESA_CALLBACK_SECRET`
   - Supabase SQL Editor:
     `insert into app_secrets (key, value) values ('mpesa_callback_secret', 'PASTE_THE_SAME_STRING');`
4. Add the other `MPESA_*` variables from `.env.example` in Vercel, then
   redeploy.
5. **Test in sandbox first**, using your own number, before going live.
   Sandbox callbacks need a public URL, so test on the deployed site
   (set `SITE_URL` to that URL), not on localhost.

**Going live:** apply for Go-Live on Daraja, then change `MPESA_ENV` to
`production` and replace the shortcode, passkey, consumer key and secret
with the production values. Keep `MPESA_CALLBACK_SECRET` the same or
update it in both places.

**Guests paying themselves:** on *My bookings*, a signed-in guest sees
**Pay with M-Pesa** on a *confirmed* booking: a 30% deposit or the full
balance (or just the balance after a deposit). The server checks that it's
their booking, that it's confirmed, that the amount doesn't exceed what's
unpaid, and blocks a second prompt within 3 minutes. Guests who booked
without an account can't self-pay; send them a prompt from the admin
instead.

**Why it's safe:** only signed-in admins can trigger a prompt (checked
server-side and by database rules). Safaricom's result is accepted only
with the secret, only for a payment that is still pending, and the app
never holds the Supabase service_role key.

**If a payment doesn't update:** check Vercel → Logs for `pay-callback`.
"Invalid callback secret" means the two secrets don't match. A guest who
was charged but sees no record: the `[pay-request]` log line holds the
CheckoutRequestID to match against your M-Pesa statement.

**Local dev:** `npm run dev` doesn't serve `/api`. Use `vercel dev` to try
payments locally (the callback still needs a public URL).

## 7. Availability calendar

The booking form on each property now shows a visual calendar: guests tap
a check-in day, then a check-out day. Unavailable nights are struck
through, and a stay can end on the day another begins.

Run `0010_availability_sync.sql`. From then on:
- **Confirming a booking** blocks its dates automatically. Changing it to
  cancelled, completed or back to pending frees them again.
- **Confirming dates that overlap** another booking or block is refused,
  and the admin sees the reason, so two guests can't hold the same nights.
- **Your own blocks** (owner stays, maintenance): Admin → Properties →
  Edit → *Availability*. The label is publicly readable, so keep it
  generic ("Owner stay").
- Bookings that were already confirmed are blocked by the migration.

Guests can still send an enquiry that overlaps a *pending* one, since
nothing is held until you confirm.

## 8. Booking emails and WhatsApp

**Emails sent automatically** (all optional, see setup below):
- Guest: enquiry received, booking confirmed, booking cancelled, and an
  M-Pesa payment receipt (with balance remaining).
- You: new enquiry alert, and payment received alert.

Each email goes out once per booking, and only if the booking is actually
in that state (a "confirmed" email can't be triggered for an unconfirmed
booking). A failed email never blocks a booking or status change.

**Setup**
1. Run `0011_notifications.sql` on Supabase (after `0008`-`0010`). It
   needs the M-Pesa callback secret from §6 to be stored already, because
   the email endpoints reuse it.
2. Create a free account at <https://resend.com>, add your domain
   (natakaholidays.co.ke) and add the DNS records it shows you.
3. In Vercel add `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` and
   `NOTIFY_ADMIN_EMAIL` (see `.env.example`), then redeploy.
4. Send yourself a test enquiry on the live site.

Skip steps 2-3 and the site simply sends no email.

**WhatsApp guest** (no setup): in Admin → Bookings, expand a booking and
tap *WhatsApp guest* to open a chat with a ready-written message for that
booking's status. It only appears for valid Kenyan mobile numbers.

**Fixed in this release:** guests booking *without an account* could be
blocked from sending an enquiry by the database's privacy rules (the form
tried to read the new booking back, which only the owner or an admin may
do). The form now creates the booking without reading it back.

## 9. Security hardening (run before launch)

Run `0012_security_hardening.sql`. The pre-launch review found that, while
the database rules controlled *who* could write a row, they didn't limit
*which fields*. Until 0012 is applied, a signed-in user could make
themselves an admin, approve their own reviews, or create bookings already
marked confirmed. 0012 closes all of these, makes the database (not the
browser) calculate each booking's estimated total, and adds size limits to
the booking and contact forms.

You can still promote an admin from the Supabase SQL editor
(`update profiles set role = 'admin' where id = '...'`), since that isn't
a signed-in user's request.

Then follow **`LAUNCH_CHECKLIST.md`**, which includes queries to check
nothing suspicious happened before the fix.

## 10. Arrival reminders

A few days before check-in, confirmed guests get an email with their
arrival details: check-in and check-out times, the location with a Google
Maps link (when the property has map coordinates), any balance still due
with how to pay, and the house rules. It's sent once per booking.

**Setup**
1. Run `0013_arrival_reminders.sql` on Supabase.
2. In Vercel add `CRON_SECRET` (any long random string, e.g.
   `openssl rand -hex 32`) and redeploy. Vercel then runs
   `/api/send-reminders` every day at 08:00 East Africa Time (the schedule
   is in `vercel.json`).
3. Email (§8) must already be set up. Without it the job runs and sends
   nothing.

It looks 3 days ahead rather than exactly 3 days, so a missed run or a
last-minute confirmation still gets a reminder. Up to 20 are sent per run;
any extras go out the next day.

**Check it works:** Vercel → your project → Logs → filter
`send-reminders`. Each run logs how many reminders were due, sent,
skipped and failed. You can also trigger it by hand with
`curl -H "Authorization: Bearer <CRON_SECRET>" https://natakaholidays.co.ke/api/send-reminders`.

**Tip:** the email's content comes from each property's *Stay details*
(check-in/out times, house rules) and map location in the admin editor,
so fill those in properly.

## 11. Reports

**Admin → Reports** shows, for a period you choose (this month, last month,
next 30 days, last 90 days, this year):
- **Collected:** payments received in the period (M-Pesa, cash and bank).
- **Booked value:** totals of confirmed and completed stays that start in
  the period.
- **Balance still owed:** unpaid balance across every confirmed booking.
- **Enquiry → booking:** share of enquiries received in the period that
  became confirmed or completed.
- **By property:** stays, booked nights, occupancy, booked value and
  collected, so you can see which homes earn their keep.
- **Arriving in the next 14 days:** who is coming, what they still owe, and
  a WhatsApp button to chase the balance.
- **Download CSV:** every booking overlapping the period, with total, paid
  and balance, for your accountant. Guest-typed text that looks like a
  spreadsheet formula is neutralised so opening the file is safe.

No database changes are needed. It reads the bookings and payments you
already have. Pending, contacted and cancelled bookings never count as
revenue, and an unpaid booking shows in *Booked value* and *Balance owed*,
not *Collected*. Record cash and bank payments as described in §12 so they count here.

## 12. Cash and bank payments

Run `0014_manual_payments.sql`. Then in **Admin → Bookings → expand a
booking → Payments**, use **Record cash or bank payment**: amount, method
(cash, bank transfer or other), the date the money was received, and an
optional note such as a bank reference. It counts straight away toward the
booking's paid total, the balance shown to the guest, self-pay limits, the
arrival reminder's balance, and the Reports page (on the day you choose).

A mistaken manual entry can be removed with **Remove** beside it. M-Pesa
payments can't be removed: they're a record of what Safaricom reported.
No receipt email is sent for manual payments.

## 13. Speed on mobile networks

What was changed, and what you should know:
- **Photos are shrunk on upload.** A phone photo (often 3-8 MB) is resized
  to 1920px on its longest side and saved as WebP in the browser before
  it's uploaded, typically 200-500 KB. You can now upload originals up to
  25 MB. **Photos uploaded before this release are still full size**: to
  speed up those listings, delete and re-upload the main photos (start
  with each property's cover photo).
- **Fonts are bundled with the site** rather than fetched from Google, so
  there are no extra connections before text appears.
- **Photos load smartly:** the main photo on a page loads first, others
  load as you scroll, and photos are cached by the browser for a year.
- The site connects to Supabase early, while the page is still loading.

**Optional, paid Supabase plans only:** set `VITE_IMAGE_TRANSFORMS=true` in
Vercel (and redeploy) to have Supabase serve right-sized copies of every
photo, including old uploads, with no re-uploading. Don't enable it on the
free plan; images would fail to load.

**Test it:** open your site in Chrome, DevTools → Network → set throttling
to "Slow 4G", reload, and check the home and a property page feel fast.
Or run PageSpeed Insights (pagespeed.web.dev) on your live URL; aim for
green on mobile.

## 14. Accessibility

An accessibility pass found and fixed:
- **Text colours that didn't exist.** Several greys used across the app
  (charcoal 400/600/800) were never defined, so those styles silently did
  nothing and the text fell back to near-black. 600 and 800 are now
  defined as dark, AA-passing greys, and hint text uses 600. The error and
  gold badge colours were deepened slightly to pass the 4.5:1 minimum.
  Your brand's Muted Text (#687678) and Palm Green are unchanged. Muted
  Text measures 4.30:1 on the ivory background, just under AA; it's used
  for secondary text only. To make it AA, darken `--color-charcoal-500` in
  `src/index.css` to `#5f6d6f` (one line).
- **Form fields without labels.** The filters (sort, type, price, guests,
  bedrooms, amenities), the enquiry message box, the property-type
  selector and the profile email now announce properly in a screen reader.
  Error messages on text areas are now connected to their field.
- **Keyboard use.** The photo upload areas can be opened with Enter or
  Space. The photo viewer is a proper dialog: focus moves into it, Escape
  closes it, arrow keys move between photos, and focus returns afterwards.
  A "Skip to main content" link appears on the first Tab press.
- **Touch targets.** Calendar days and month buttons are 40px (were 36px
  and 28px).
- **Smaller fixes:** photo descriptions no longer say "photo photo",
  and admin table action columns have a hidden "Actions" label.

Already in place: visible focus outlines, reduced-motion support,
screen-reader names on icon buttons, and menus that manage focus.

**Still worth doing by hand before launch:** tab through the booking form
and calendar with only a keyboard, then try VoiceOver (iPhone) or TalkBack
(Android) on the home page and one property page. Lighthouse in Chrome
DevTools (Accessibility category) is a quick second check; aim for 95+.

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

## Performance and security headers

`vercel.json` sets long-lived immutable caching for hashed `/assets/*` files and basic security headers site-wide. `public/robots.txt` blocks crawling of admin, auth and account pages.

## Known gaps at time of writing

- M-Pesa only (no card payments). Self-pay needs a signed-in guest and a
  confirmed booking; guest-checkout enquiries are paid via an admin prompt.
- A payment doesn't change the booking's status; an admin still confirms
  bookings manually.

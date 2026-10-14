# Launch checklist — Nataka Holidays

Work top to bottom (`SETUP_GUIDE.md` has the same steps in plain order). Items marked **(you)** are done in a dashboard, not in code.

## 1. Database (Supabase SQL editor)
- [ ] Run every file in `supabase/migrations/` in order, up to **`0016_shop.sql`** (`0012` is the security fix: don't skip it).
- [ ] **Check who is an admin.** Run: `select id, full_name, role from profiles where role = 'admin';`
      Before 0012, any signed-in user could promote themselves, so make sure every row is someone you know.
      Demote anyone unexpected: `update profiles set role = 'customer' where id = '...';`
- [ ] **Check reviews.** Run: `select id, property_id, customer_id, rating, status, created_at from reviews where status = 'approved' order by created_at desc;`
      Before 0012, customers could approve their own. Delete or reject any you didn't approve.
- [ ] **Check bookings.** Run: `select id, guest_name, status, check_in, check_out, created_at from bookings where status in ('confirmed','completed') order by created_at desc;`
      Anything you didn't set yourself is suspect (guests could insert these statuses before 0012).
- [ ] Store the callback secret: `insert into app_secrets (key, value) values ('mpesa_callback_secret', '<long random string>');`

> The migrations and security rules were already dry-run on a scratch
> PostgreSQL (171 checks pass, see `DEPLOYMENT.md` §16), so the list below
> is about your real Supabase project and live services.

## 2. Supabase dashboard settings (you)
- [ ] **Authentication → URL configuration:** set Site URL to `https://natakaholidays.co.ke` and add it (plus `/reset-password`) to Redirect URLs.
- [ ] **Authentication → Providers → Email:** turn on "Confirm email" so people can't sign up with someone else's address.
- [ ] **Authentication → Attack protection:** enable CAPTCHA (Cloudflare Turnstile is free) and leaked-password protection.
- [ ] **Authentication → Sign In / Providers:** make sure anonymous sign-ins are OFF.
- [ ] **Authentication → Rate limits:** leave the defaults or tighten them.
- [ ] **Database → Backups:** confirm daily backups are on (point-in-time recovery needs a paid plan).
- [ ] Confirm the `service_role` key is **not** set anywhere (Vercel, `.env`, code). The app never needs it.

## 3. Vercel (you)
- [ ] Environment variables set for **Production**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WHATSAPP_NUMBER`, `SITE_URL`.
- [ ] M-Pesa: `MPESA_ENV`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_SECRET` (identical to the database value).
- [ ] Email: `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `NOTIFY_ADMIN_EMAIL`, with the domain verified in Resend.
- [ ] No `MPESA_*`, `RESEND_*` or secret value starts with `VITE_` (that would publish it to every visitor).
- [ ] `CRON_SECRET` set (arrival reminders), and the daily job shows in Vercel → Settings → Cron Jobs.
- [ ] Custom domain attached and HTTPS working.

## 4. Test on the live site
- [ ] Sign out, send a booking enquiry as a guest. It saves, and you get the alert email.
- [ ] Sign in as admin, confirm it. Guest gets the email, dates grey out on the property page.
- [ ] Try confirming a second booking for the same nights: it must be refused.
- [ ] M-Pesa **sandbox**: send a prompt to the test number `254708374149` (the sandbox never reaches a real phone), see Paid + receipt email.
- [ ] Sign in as a normal customer and open `/admin`: you must be turned away.
- [ ] Arrival reminder: confirm a booking starting in 2 days, run the `curl` command in `DEPLOYMENT.md` §10, check the email arrives.
- [ ] Paste links into WhatsApp: a property link, and also the home page, `/holiday-homes`, `/about` and `/contact`. Each should show its own title and a picture. If one looks stale, add `?v=2` to the link (see `DEPLOYMENT.md`, Link previews).
- [ ] Open the site on a phone: calendar, booking form, My bookings. Tap a form field on an iPhone: the page must not zoom in.
- [ ] Accessibility: tab through the booking form with only the keyboard, then run Lighthouse (Chrome DevTools → Accessibility) on the home page, a property page and the booking form. Aim for 95+.
- [ ] Re-upload each property's cover photo (and any big photos uploaded before the speed update), then run PageSpeed Insights on the live home page and a property page.

## 5. Going live with money
- [ ] Complete Daraja **Go-Live** with Safaricom.
- [ ] Switch `MPESA_ENV` to `production` and use the production shortcode, passkey and keys.
- [ ] Do one real KSh 10 payment to yourself and confirm it appears, then refund it from the M-Pesa side.

## 6. Ongoing
- [ ] The admin Dashboard and Bookings pages now warn you when a payment has been **Waiting for PIN** for over 5 minutes. If you see it, check your M-Pesa statement, then Vercel → Logs → `pay-callback`. If no money was taken, tap **Mark as failed** on that payment.
- [ ] Rotate `MPESA_CALLBACK_SECRET` (in Vercel **and** the `app_secrets` row) if you ever think it leaked. It appears in the callback URL, so it can show up in Vercel logs.
- [ ] Before confirming a booking, glance at the total. It is now computed by the database from the property's price, but check it's right.

## Shop

- [ ] `0016_shop.sql` run in Supabase; Settings > Shop delivery fee set.
- [ ] At least one product added with a photo, price and stock.
- [ ] Test order on a phone: add to cart, check out, pay with M-Pesa, see **Paid** in My orders, see it under Admin > Shop orders, receipt email arrives.
- [ ] Cancel an unpaid test order and check the stock goes back up.

# Launch checklist — Nataka Holidays

Work top to bottom. Items marked **(you)** are done in a dashboard, not in code.

## 1. Database (Supabase SQL editor)
- [ ] Run every file in `supabase/migrations/` in order, up to **`0014_manual_payments.sql`** (`0012` is the security fix: don't skip it).
- [ ] **Check who is an admin.** Run: `select id, full_name, role from profiles where role = 'admin';`
      Before 0012, any signed-in user could promote themselves, so make sure every row is someone you know.
      Demote anyone unexpected: `update profiles set role = 'customer' where id = '...';`
- [ ] **Check reviews.** Run: `select id, property_id, customer_id, rating, status, created_at from reviews where status = 'approved' order by created_at desc;`
      Before 0012, customers could approve their own. Delete or reject any you didn't approve.
- [ ] **Check bookings.** Run: `select id, guest_name, status, check_in, check_out, created_at from bookings where status in ('confirmed','completed') order by created_at desc;`
      Anything you didn't set yourself is suspect (guests could insert these statuses before 0012).
- [ ] Store the callback secret: `insert into app_secrets (key, value) values ('mpesa_callback_secret', '<long random string>');`

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
- [ ] M-Pesa **sandbox**: send a prompt to your own phone, enter the PIN, see Paid + receipt email.
- [ ] Sign in as a normal customer and open `/admin`: you must be turned away.
- [ ] Arrival reminder: confirm a booking starting in 2 days, run the `curl` command in `DEPLOYMENT.md` §10, check the email arrives.
- [ ] Paste a property link into WhatsApp: photo and title appear.
- [ ] Open the site on a phone: calendar, booking form, My bookings.
- [ ] Accessibility: tab through the booking form with only the keyboard, and run Lighthouse (Accessibility) on the home page and a property page.
- [ ] Re-upload each property's cover photo (and any big photos uploaded before the speed update), then run PageSpeed Insights on the live home page and a property page.

## 5. Going live with money
- [ ] Complete Daraja **Go-Live** with Safaricom.
- [ ] Switch `MPESA_ENV` to `production` and use the production shortcode, passkey and keys.
- [ ] Do one real KSh 10 payment to yourself and confirm it appears, then refund it from the M-Pesa side.

## 6. Ongoing
- [ ] Check the admin Bookings page for **Waiting for PIN** payments older than a few minutes (callback problems show in Vercel → Logs → `pay-callback`).
- [ ] Rotate `MPESA_CALLBACK_SECRET` (in Vercel **and** the `app_secrets` row) if you ever think it leaked. It appears in the callback URL, so it can show up in Vercel logs.
- [ ] Before confirming a booking, glance at the total. It is now computed by the database from the property's price, but check it's right.

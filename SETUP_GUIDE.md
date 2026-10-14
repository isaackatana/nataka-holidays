# Nataka Holidays: go-live setup guide

Follow this top to bottom. Each step says where to click. Detail for any
step is in `DEPLOYMENT.md` and `LAUNCH_CHECKLIST.md`. Tick things off in
`LAUNCH_CHECKLIST.md` as you go.

Have these ready: a GitHub account, your Supabase and Vercel logins, and
access to the DNS settings for natakaholidays.co.ke.

---

## Step 1. Supabase: database

1. Open your Supabase project, then **SQL Editor**.
2. Run every file in `supabase/migrations/` **in number order**, from
   `0001` to `0016`. Do not skip `0012`; it is the security fix.
3. Make a long random string for the M-Pesa callback secret (on a
   computer: `openssl rand -hex 32`). Save it somewhere safe; you will
   paste it twice. Then run:
   ```sql
   insert into app_secrets (key, value)
   values ('mpesa_callback_secret', 'PASTE_THE_STRING_HERE');
   ```
4. Check the three things the checklist asks about (admins, approved
   reviews, confirmed bookings). The queries are in section 1 of
   `LAUNCH_CHECKLIST.md`. Anything you do not recognise should be removed.

## Step 2. Supabase: settings

In **Authentication**:
- **URL configuration:** Site URL = `https://natakaholidays.co.ke`. Add it
  and `https://natakaholidays.co.ke/reset-password` to Redirect URLs.
- **Providers → Email:** turn on **Confirm email**.
- **Attack protection:** turn on CAPTCHA (Cloudflare Turnstile is free) and
  leaked-password protection.
- **Sign In / Providers:** make sure **anonymous sign-ins** are off.

In **Database → Backups:** confirm daily backups are on.

Copy two values from **Project Settings → API**: the Project URL and the
`anon` public key. Do **not** copy the `service_role` key anywhere.

## Step 3. Vercel: deploy

1. Push the project to GitHub, then in Vercel choose **New Project** and
   import it. Vite is detected automatically.
2. In **Project Settings → Environment Variables**, add these to
   Production (and Preview if you use it):

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL from Step 2 |
   | `VITE_SUPABASE_ANON_KEY` | the `anon` key |
   | `VITE_WHATSAPP_NUMBER` | your WhatsApp number, international format, no `+` |
   | `SITE_URL` | `https://natakaholidays.co.ke` |
   | `MPESA_CALLBACK_SECRET` | the same string as Step 1 |
   | `CRON_SECRET` | another long random string |

3. Deploy. Then add the domain under **Settings → Domains**, add the DNS
   records Vercel shows you at your registrar, and wait for HTTPS to work.

## Step 4. First admin

1. On the live site, sign up with your own email and confirm it.
2. In Supabase, **Authentication → Users**, copy your user ID.
3. In the SQL Editor run:
   ```sql
   update profiles set role = 'admin' where id = 'YOUR-USER-ID';
   ```
4. Sign out and back in. `/admin` should now open.
5. Add your properties, photos, stay details (check-in/out times, house
   rules) and map location. The arrival emails use these.

## Step 5. Email (Resend)

1. Create a free account at resend.com and add `natakaholidays.co.ke`.
2. Add the DNS records Resend shows you, and wait until it says Verified.
3. In Vercel add `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` (an address on your
   domain) and `NOTIFY_ADMIN_EMAIL` (where you want alerts), then redeploy.

## Step 6. M-Pesa sandbox test

1. At developer.safaricom.co.ke create an app and copy the consumer key and
   secret.
2. In Vercel add: `MPESA_ENV` = `sandbox`, `MPESA_CONSUMER_KEY`,
   `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE` = `174379`, and `MPESA_PASSKEY`
   (the public sandbox passkey on the Daraja "Simulate" page). Make sure
   `SITE_URL` is the address the site is really live on, because Safaricom
   sends the result there. Redeploy.
3. On the live site: confirm a booking in admin, then in **Admin → Bookings
   → M-Pesa payments** send a prompt to the Safaricom **test number**
   `254708374149`. The sandbox does not send anything to a real phone: it
   pretends the customer paid and sends the result to your site a few
   seconds later. It should show **Paid** and the receipt email should be
   sent. (Use the test number, not your own; real numbers only work after
   you go live in Step 8.)
4. If it stays on "Waiting for PIN", open Vercel → Logs and filter
   `pay-callback`. "Invalid callback secret" means Step 1 and Step 3
   used different strings.

## Step 7. Test the live site

Do the list in section 4 of `LAUNCH_CHECKLIST.md`: guest enquiry, admin
confirm, double-booking refused, customer cannot open `/admin`, reminder
email, WhatsApp link preview, phone check, Lighthouse accessibility.

## Step 8. Real money

1. Apply for **Go-Live** with Safaricom on Daraja. This takes time, so you
   can apply early.
2. When approved, set `MPESA_ENV` = `production` and replace the shortcode,
   passkey, consumer key and consumer secret with the production values.
   Redeploy.
   **Because you collect on a Till (Buy Goods)**, also set:
   - `MPESA_TRANSACTION_TYPE` = `CustomerBuyGoodsOnline`
   - `MPESA_SHORTCODE` = your **Store / Head Office number** (the number
     Safaricom gives you for Daraja, which is not always the Till itself)
   - `MPESA_PARTY_B` = your **Till number**
   If your Till is its own store (one number only), set `MPESA_SHORTCODE` to
   the Till and leave `MPESA_PARTY_B` out. Safaricom confirms which numbers
   to use when your Go-Live is approved. Sandbox keeps using the settings
   from Step 6.
3. Make one real KSh 10 payment to yourself, confirm it shows up, then
   refund it from the M-Pesa side.

## Shop (after payments work)

1. Run `supabase/migrations/0016_shop.sql` in the Supabase SQL editor.
2. In the admin, open **Settings** and set the delivery fee.
3. Open **Products** and add your first items with photos, prices and stock.
4. Open `/shop` on your phone, place a KSh-small test order, and check the
   order shows under **Shop orders** and the receipt email arrives.

## Afterwards

- The admin **Dashboard** and **Bookings** pages show a yellow warning if a payment has been stuck on
  "Waiting for PIN" for over 5 minutes. Check your M-Pesa statement, then
  Vercel → Logs → `pay-callback`. If no money was taken, open the booking and
  tap **Mark as failed** on that payment.
- If you ever think the callback secret leaked, change it in **both**
  Vercel and the `app_secrets` row.
- Check the total on a booking before you confirm it.

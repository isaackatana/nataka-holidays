# Go-live guide: Vercel settings and the real tests

Do the parts in order. Part 1 (Supabase) is covered in `SUPABASE_SECURITY_GUIDE.md`
and the migrations in `LAUNCH_CHECKLIST.md`; this guide picks up from there.

Vercel menu names can change slightly. If one differs, look for the closest match.

---

## Part A. Vercel environment variables

**Vercel → your project → Settings → Environment Variables.** For each row, add
the name and value, tick **Production** (also **Preview** for the first group, so
preview builds don't fail), and save. **Changing any variable only takes effect
after a redeploy:** *Deployments → the latest one → ⋯ → Redeploy*.

### The site itself (tick Production, Preview and Development)

| Name | Value | Where to find it |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | long key starting `eyJ…` | Same page, the **anon / public** key only |
| `VITE_WHATSAPP_NUMBER` | e.g. `254712345678` | Your business WhatsApp, with country code, **no `+`** |

### Payments (Production only)

| Name | Value | Where to find it |
|---|---|---|
| `MPESA_ENV` | `sandbox` for now | Change to `production` only in Part D |
| `MPESA_CONSUMER_KEY` | from Daraja | developer.safaricom.co.ke → My Apps → your app |
| `MPESA_CONSUMER_SECRET` | from Daraja | Same place |
| `MPESA_SHORTCODE` | sandbox: `174379` | Production: your Paybill, or Store/Head Office number for a Till |
| `MPESA_PASSKEY` | sandbox passkey | Daraja → the **Simulate / STK Push** page shows the public sandbox passkey |
| `MPESA_CALLBACK_SECRET` | a long random string | Make one at <https://www.random.org/strings/> (40+ characters, letters and numbers). **The exact same string must also be saved in Supabase**, see below |

If you use a **Till (Buy Goods)** instead of a Paybill, also add
`MPESA_TRANSACTION_TYPE` = `CustomerBuyGoodsOnline` and `MPESA_PARTY_B` = your Till
number (see `.env.example`).

**Save the same secret in Supabase** (SQL Editor), swapping in your string:

```sql
insert into app_secrets (key, value) values ('mpesa_callback_secret', 'PASTE_THE_SAME_STRING');
```

### Email and reminders (Production only)

| Name | Value |
|---|---|
| `RESEND_API_KEY` | Resend → API Keys → create one |
| `NOTIFY_FROM_EMAIL` | `Nataka Holidays <bookings@natakaholidays.co.ke>` (must be on a domain verified in Resend) |
| `NOTIFY_ADMIN_EMAIL` | The address that should get new-enquiry, payment and review alerts |
| `CRON_SECRET` | Another long random string (not the same as the M-Pesa one) |

In Resend: **Domains → Add Domain** (`natakaholidays.co.ke`), add the DNS records it
shows at your domain registrar, then press **Verify**. It can take from a few
minutes to a few hours.

### Optional

| Name | Value |
|---|---|
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key. **Only add it by following `SUPABASE_SECURITY_GUIDE.md` §5.** |
| `SITE_URL` | Leave unset unless you use a different domain |

### Three mistakes to avoid

1. **Never** start a secret's name with `VITE_` (`MPESA_…`, `RESEND_…`, `CRON_SECRET`
   must not). Anything starting with `VITE_` is published to every visitor.
2. **Never** add the Supabase `service_role` key anywhere.
3. A stray space or line break when pasting a value breaks it silently. If
   something later says "invalid secret", re-paste both copies of
   `MPESA_CALLBACK_SECRET` carefully.

When done: **Redeploy**, then open the live site and check it loads.

---

## Part B. Run the migrations

Supabase → **SQL Editor**. Run every file in `supabase/migrations/` in number order, up to
the highest (currently `0023_review_alert.sql`). Do not skip `0012`. Each should end
with "Success". If one errors, stop and send me the message.

---

## Part C. The tests, in order

Do these on the **live site** (M-Pesa callbacks can't reach your laptop). If a test
fails, fix it before the next one.

| # | Test | You should see | If not |
|---|---|---|---|
| 1 | Signed out, send a booking enquiry on a property | "Enquiry sent"; an alert email arrives at `NOTIFY_ADMIN_EMAIL`; the guest gets an "enquiry received" email | No email: check `RESEND_API_KEY`, domain shows **Verified** in Resend, Vercel → Logs for `[notify]` |
| 2 | Sign in as admin → Bookings → **Confirm** it | Guest gets a "confirmed" email; the dates grey out on the property page | No grey dates: `0010` migration not run |
| 3 | Try to confirm a **second** booking for the same nights | Refused | Tell me; this is a serious fault |
| 4 | Sign in as a **normal customer** and open `/admin` | You are turned away | Tell me; this is a serious fault |
| 5 | M-Pesa **sandbox**: Bookings → expand a confirmed booking → send a prompt to `254708374149` | Payment shows **Paid**; a receipt email goes out | Stuck on "Waiting for PIN": Vercel → Logs → `pay-callback`. "Invalid callback secret" = the two secrets differ |
| 6 | Arrival reminder: confirm a booking starting in 2 days, then run in a terminal: `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://natakaholidays.co.ke/api/send-reminders` | JSON with `sent: 1`; the guest email arrives | 401: wrong `CRON_SECRET` (or not redeployed) |
| 7 | Reviews: mark a test booking **Completed**, sign in as that guest, write a review with a photo on **My bookings** | You get the "new review" email; it appears under Admin → Reviews; after you approve it, it shows on the property page | See `LAUNCH_CHECKLIST.md` |
| 8 | On a phone: calendar, booking form, My bookings; tap a form field on an iPhone | Page does not zoom in | Tell me which screen |

Tip for test 6: for the "How was your stay?" email, mark a booking Completed with a
check-out date in the last 2 weeks and run the same `curl`; look for `reviewRequests`
in the answer.

---

## Part D. Switch M-Pesa to real money (only after Part C passes)

1. In Daraja, apply for **Go Live** and wait for Safaricom's approval.
2. In Vercel, change `MPESA_ENV` to `production` and replace
   `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CONSUMER_KEY` and
   `MPESA_CONSUMER_SECRET` with the **production** values. Leave
   `MPESA_CALLBACK_SECRET` as it is.
3. **Redeploy.**
4. Make one real payment of **KSh 10** to yourself from the admin. Confirm it shows
   **Paid**, the receipt email arrives, and the money is in your M-Pesa
   statement. Then refund it from the M-Pesa side.

---

## Part E. First week

- Every morning, glance at the admin **Dashboard**: yellow notices mean a payment is
  stuck, or reviews are waiting for you.
- Vercel → **Logs**: search for `error` once a day for the first week.
- Mark stays **Completed** after checkout so guests get the review email.

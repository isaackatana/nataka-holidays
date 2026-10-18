# Supabase security settings: click-by-click

Do these once, in your **production** Supabase project, before launch. Supabase
renames menu items from time to time, so if a label differs slightly, look for
the closest match under **Authentication**.

Takes about 20 minutes. Do them in this order.

---

## 1. Site URL and redirect links

**Authentication → URL Configuration**

1. **Site URL:** `https://natakaholidays.co.ke`
2. **Redirect URLs:** add these two, one per line:
   - `https://natakaholidays.co.ke`
   - `https://natakaholidays.co.ke/reset-password`
3. Save.

Why: password-reset and confirmation links only work for addresses on this list,
and it stops links being redirected to someone else's site.

## 2. Make people confirm their email

**Authentication → Sign In / Providers → Email**

1. Make sure **Email** is enabled.
2. Turn **Confirm email** ON.
3. Save.

Why: otherwise someone can create an account with an address that isn't theirs.

### Important: set up sending email before you turn this on

Supabase's built-in email sender is for testing only and allows very few emails
per hour. With Confirm email on, a few sign-ups in an hour can lock new guests
out. You already use Resend, so use it here too:

1. In Resend, **Domains** → make sure `natakaholidays.co.ke` is verified.
2. In Supabase, **Authentication → Emails → SMTP Settings** (or **Project
   Settings → Auth → SMTP**) → turn on **Custom SMTP**.
3. Fill in Resend's SMTP details: host `smtp.resend.com`, port `465`, username
   `resend`, password = your Resend API key. Sender email e.g.
   `accounts@natakaholidays.co.ke`, sender name `Nataka Holidays`.
4. Save, then register a test account with a real address and confirm the
   email arrives.

## 3. Turn off anonymous sign-ins

**Authentication → Sign In / Providers** (the **User Signups** area)

Make sure **Allow anonymous sign-ins** is **OFF**. The site never uses them.

## 4. Rate limits

**Authentication → Rate Limits**

The defaults are fine to launch with. Leave them unless you see abuse.

## 5. CAPTCHA (blocks bots from sign-up, sign-in and password reset)

**Read this first: turning CAPTCHA on in Supabase before the site is set up for
it locks everyone out** (nobody could sign in, register or reset a password).
The site now supports it, but only once you do the steps below **in this order**.

1. **Cloudflare** (free account at cloudflare.com) → **Turnstile** → **Add
   widget**.
   - Name: `Nataka Holidays`
   - Hostname: `natakaholidays.co.ke` (add `localhost` too if you test locally)
   - Widget mode: **Managed**
   - You get a **Site key** (public) and a **Secret key** (private).
2. **Vercel** → your project → **Settings → Environment Variables** → add
   `VITE_TURNSTILE_SITE_KEY` = the **Site key**, for **Production**. Then
   **redeploy** (a new build is needed to pick it up).
3. Open the live site's sign-in page. You should now see the Cloudflare check
   box. Sign-in still works at this point, because Supabase isn't asking for it
   yet.
4. **Supabase → Authentication → Attack Protection** (also called **Bot and
   Abuse Protection**) → turn on **Enable Captcha protection**, choose
   **Cloudflare Turnstile**, paste the **Secret key**, save.
5. Test all three on the live site: **sign in**, **create account**, **forgot
   password**. Each must still work.

**If anything breaks,** go back to Supabase and turn Captcha protection off. The
site goes straight back to normal.

Never put the **Secret key** in Vercel or in the code, only in Supabase.

## 6. Leaked-password check (Pro plan only)

**Authentication → Sign In / Providers → Email** (or **Authentication →
Passwords**) → turn on **Prevent use of leaked passwords**.

This needs Supabase's **Pro plan** or above. On the free plan the switch isn't
available; skip it, and instead set **Minimum password length** to **10** or
more in the same place.

## 7. Backups

**Database → Backups**

Check that backups are on. Daily backups come with the **Pro** plan; the free
plan doesn't keep them for you. If you stay on free, take a manual copy before
any big change (for example before running new migrations).

## 8. Make sure the service_role key isn't used anywhere

**Project Settings → API** shows two keys: **anon** (public, safe) and
**service_role** (all-powerful).

1. In **Vercel → Settings → Environment Variables**, check there is **no**
   variable holding the `service_role` key.
2. The only Supabase keys the site needs are `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
3. If you ever pasted `service_role` anywhere public, rotate it in Supabase
   (**Project Settings → API → JWT Settings**) straight away.

---

## Quick check afterwards

- [ ] Sign up with a new address: confirmation email arrives, link works.
- [ ] Sign in, sign out, **Forgot password** all work with the CAPTCHA on.
- [ ] Open `/admin` as a normal customer: turned away.

# Review rules check

These scripts check the guest-review security rules (migrations 0018-0023)
against a plain PostgreSQL, without needing Supabase.

1. Create an empty database.
2. Run `supabase_stub.sql` (stands in for Supabase's `auth` and `storage` parts).
3. Run every file in `supabase/migrations/` in order.
4. Run `reviews_rules.sql` and read the output: each `T..` line says what was
   tested (guests can't self-approve, can't review stays they didn't take, can't
   forge replies, photo limit and storage folder rules, public sees only
   approved reviews and photos, and so on). Lines that show an `ERROR` right
   after a "(expect error)" or "cannot" heading are the rules working.

Last run: all migrations applied cleanly and every check behaved as intended.

## Experience requests check

After the steps above, `experience_requests_rules.sql` (run it after
`reviews_rules.sql`, which creates the sample users and a property) checks
migration 0025: the database works out each request's price and total itself,
every request starts as New, a passed date / oversized group / unpublished
experience is refused, guests can read only their own requests and cannot
confirm or delete them, and the email "send once" claim works only for the
first caller and only with the server secret.

## Experience reviews check

Then `experience_reviews_rules.sql` (needs the data the two scripts above
create) checks migration 0026: a guest can review an experience only after you
mark their request Completed, only once per request, can't approve their own
review, write the business reply or choose the shown name, an edit goes back to
Pending while your reply stays, and the public sees only approved reviews.

## Experience payments check

Then `experience_payments_rules.sql` checks migration 0027, the money rules:
the amount to pay is always worked out by the database (deposit first, then the
balance) and the browser cannot choose it, other guests learn nothing about a
request, only a confirmed request with a deposit % and a price can be paid,
guests cannot write or edit payment rows, a second prompt within 90 seconds is
refused, the M-Pesa result resolves a payment once (a replay changes nothing and
a wrong secret is refused), a failed payment does not count, and the admin can
set an agreed total and record cash while a guest cannot.

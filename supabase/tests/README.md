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

## Shop colours / options check

`shop_variants_rules.sql` (run it after all migrations, including 0028) checks
that a product with colours sells only by colour, each colour has its own
stock, the product's stock stays equal to the total, the database prices the
order and names the colour on the order line, and stock goes back when an
order is cancelled or expires (and is taken again if money arrives late).
It also checks that a product without colours still works exactly as before.
Run: `psql -d nataka_test -f supabase/tests/shop_variants_rules.sql`


## Shop product reviews check

`product_reviews_rules.sql` (run after all migrations including 0029, and after
`shop_variants_rules.sql`, whose sample shopper and products it reuses) checks
that only a guest whose order you marked Completed, and that contained the
product, can review it; one review per guest per product; every review and
every edit starts Pending; guests cannot forge a reply, name or approval; the
public sees only approved reviews and the rating summary.

## Shop discount codes check

`discount_codes_rules.sql` (run after all migrations including 0030, on a
database where no other shop test data conflicts) checks: percentage and fixed
codes, any letter case, delivery fee never discounted, an order can never be
free, minimum spend, expiry / switched-off / unknown codes, once-per-guest,
total-uses limit, the use being given back when an order is cancelled or
expires (and taken again if payment arrives late), guess throttling at the
checkout box, guests being unable to list codes, and the e-mail data carrying
the discount.

## Shop low-stock alerts check

`low_stock_rules.sql` (run after all migrations including 0031) checks which
items count as low (colours listed one by one, hidden products ignored),
that the same list is not e-mailed twice but a change in stock makes a new
e-mail due, that threshold 0 switches the e-mails off, that the two server
functions refuse a wrong secret, and that guests cannot change the threshold.

## Shop "back in stock" requests check

`back_in_stock_rules.sql` (run after all migrations including 0032) checks that a
guest can wait only for something that really is sold out (a colour counts on
its own), cannot ask twice, sees only their own requests while the owner sees
what is waiting, is due an e-mail only once the item is back (one entry per
guest listing everything that is back), that requests are removed once
e-mailed, the 20-request limit, and that the two server functions refuse a
wrong secret.

## Shop gift wrap check

`gift_wrap_rules.sql` (run after all migrations including 0033) checks that gift
wrapping can only be chosen while you have set a fee (so it cannot be switched
on from the browser), that the fee is added once per order and never
discounted, that the message is trimmed, dropped when not wrapping and limited
to 200 characters, that the order e-mail data carries it, and that such
orders can still be cancelled.

## Shop related products check

`related_products_rules.sql` (run after all migrations including 0034) checks the
cart suggestions are ranked by how often products were bought together in PAID
orders, then same category, then newest; that the cart's own items, sold-out and
hidden products are never suggested; that unpaid orders do not count; the limit
is capped at 8; and visitors who are not signed in can use it.

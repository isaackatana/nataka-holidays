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

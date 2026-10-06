# Database tests

These check the migrations and the row-level-security rules against a real
(local, throwaway) PostgreSQL, acting as a guest, a customer and an admin:
privilege escalation, booking/review/payment rules, the availability
trigger, the M-Pesa and email functions, and form size limits.

```
bash supabase/tests/run.sh
```

It never touches your live Supabase. `supabase_shim.sql` creates minimal
stand-ins for the Supabase pieces the migrations use (the `anon` /
`authenticated` roles, `auth.users`, `auth.uid()`, `storage`). Re-run it
after adding or changing any migration. Add a new case to
`security_test.py` whenever you add a rule you rely on.

Requires PostgreSQL 15+ and python3. (Not run by `npm test`.)

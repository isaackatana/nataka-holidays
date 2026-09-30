-- =========================================================
-- 0008_payments.sql
-- M-Pesa (Safaricom Daraja STK Push) payments against bookings.
--
-- Flow: an admin sends an STK prompt from /admin/bookings (api/pay-request.js,
-- which runs with the ADMIN'S OWN session, so RLS below is what lets it
-- insert). Safaricom later calls api/pay-callback.js, which is anonymous,
-- so it can only change a payment through record_mpesa_result() — a
-- security-definer function that refuses to do anything unless it is
-- given the shared secret stored in app_secrets. No service_role key is
-- used anywhere.
-- =========================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  amount int not null check (amount > 0),
  phone text not null,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  checkout_request_id text not null unique,
  merchant_request_id text,
  mpesa_receipt text,
  result_desc text,
  paid_amount int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_payments_booking on payments (booking_id);

create trigger trg_payments_updated_at
  before update on payments
  for each row execute function set_updated_at();

alter table payments enable row level security;

-- Admins see everything; a customer sees payments on their own bookings.
create policy "payments_select_own_or_admin"
  on payments for select
  using (
    is_admin()
    or exists (
      select 1 from bookings b
      where b.id = payments.booking_id and b.customer_id = auth.uid()
    )
  );

-- Only admins can create a payment row, and only as 'pending'. Nobody
-- can update or delete through the API: results arrive via the RPC below.
create policy "payments_insert_admin"
  on payments for insert
  with check (is_admin() and status = 'pending');

-- ---------------------------------------------------------
-- Private key/value store. RLS on with NO policies = unreadable through
-- the API for every role; only security-definer functions can read it.
-- ---------------------------------------------------------
create table app_secrets (
  key text primary key,
  value text not null
);
alter table app_secrets enable row level security;
revoke all on app_secrets from anon, authenticated;

-- ---------------------------------------------------------
-- Called by api/pay-callback.js with the anon key. Does nothing unless
-- p_secret matches the stored mpesa_callback_secret.
-- ---------------------------------------------------------
create or replace function record_mpesa_result(
  p_secret text,
  p_checkout_request_id text,
  p_result_code int,
  p_result_desc text,
  p_receipt text,
  p_paid_amount int
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';

  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid callback secret' using errcode = '42501';
  end if;

  -- Only a still-pending payment can be resolved, so a replayed callback
  -- can't flip a finished payment.
  update payments
  set status = case when p_result_code = 0 then 'success' else 'failed' end,
      mpesa_receipt = p_receipt,
      result_desc = p_result_desc,
      paid_amount = p_paid_amount
  where checkout_request_id = p_checkout_request_id
    and status = 'pending';
end;
$$;

revoke all on function record_mpesa_result(text, text, int, text, text, int) from public;
grant execute on function record_mpesa_result(text, text, int, text, text, int) to anon, authenticated;

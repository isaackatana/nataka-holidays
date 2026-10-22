-- =========================================================
-- 0027_experience_payments.sql
--
-- Lets a guest pay for a CONFIRMED experience request by M-Pesa: first the
-- deposit, then the remaining balance. Follows the shop's safe pattern:
--   * the amount is always worked out by the database from the request's own
--     price, never chosen by the browser
--   * results come back through the same secret-guarded callback as bookings
--   * only the guest who made the request (signed in) can pay it
--
-- Online payment is OFF for an experience until you set its "Deposit %"
-- (Admin -> Experiences). The percentage is copied onto each request when it is
-- made, so editing an experience later never changes a guest's terms.
-- You can also set an "agreed total" on a request when the final price differs
-- from the estimate, and record cash / bank payments by hand.
-- =========================================================

alter table experiences
  add column deposit_percent int,
  add constraint experiences_deposit_valid check (deposit_percent is null or (deposit_percent between 1 and 100));

alter table experience_requests
  add column deposit_percent int,
  add column agreed_total numeric(10,2),
  add constraint experience_requests_agreed_total_valid check (agreed_total is null or agreed_total >= 0);

-- Request insert: also copy the deposit % and make sure a guest cannot set an agreed total.
create or replace function experience_request_before_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  exp experiences%rowtype;
  today_eat date := (now() at time zone 'Africa/Nairobi')::date;
begin
  select * into exp from experiences where id = new.experience_id;
  if not found or not exp.is_published then
    raise exception 'That experience is not available.' using errcode = '23514';
  end if;

  if new.preferred_date < today_eat then
    raise exception 'Please choose a date that has not passed.' using errcode = '23514';
  end if;

  if exp.max_group_size is not null and new.people > exp.max_group_size then
    raise exception 'This experience takes at most % people.', exp.max_group_size using errcode = '23514';
  end if;

  new.experience_title := exp.title;
  new.price_type := exp.price_type;
  new.unit_price := exp.price;
  new.deposit_percent := exp.deposit_percent;
  new.estimated_total := case
    when exp.price is null or exp.price_type is null then null
    when exp.price_type = 'per_group' then exp.price
    else exp.price * new.people
  end;

  if not is_admin() then
    new.status := 'new';
    new.notified_at := null;
    new.agreed_total := null;
    new.customer_id := auth.uid();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------
-- experience_payments
-- ---------------------------------------------------------
create table experience_payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references experience_requests(id) on delete cascade,
  amount int not null check (amount >= 1),
  phone text,
  method text not null default 'mpesa' check (method in ('mpesa', 'cash', 'bank', 'other')),
  note text,
  checkout_request_id text not null unique,
  merchant_request_id text,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  mpesa_receipt text,
  result_desc text,
  paid_amount int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experience_payments_note_length check (note is null or char_length(note) <= 300)
);

create index idx_experience_payments_request on experience_payments (request_id, status);

create trigger trg_experience_payments_updated_at
  before update on experience_payments
  for each row execute function set_updated_at();

alter table experience_payments enable row level security;

-- Admins see all; a guest sees payments on their own requests. Nobody writes
-- through the API directly: every change goes through the functions below.
create policy "experience_payments_select_own_or_admin"
  on experience_payments for select
  using (
    is_admin()
    or exists (
      select 1 from experience_requests r
      where r.id = experience_payments.request_id and r.customer_id = auth.uid()
    )
  );

create policy "experience_payments_delete_admin"
  on experience_payments for delete
  using (is_admin());

-- ---------------------------------------------------------
-- What is due on a request. One source of truth, used for what the guest
-- sees, for the amount sent to M-Pesa, and re-checked when the prompt is saved.
-- ---------------------------------------------------------
create or replace function experience_amount_due(p_request_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  r experience_requests;
  total int;
  paid int;
  dep int;
  due int;
  phase text;
  reason text := null;
begin
  select * into r from experience_requests where id = p_request_id;
  -- Same answer whether it doesn't exist or isn't yours, so ids can't be probed.
  if r.id is null or not (is_admin() or (r.customer_id is not null and r.customer_id = auth.uid())) then
    return jsonb_build_object('payable', false, 'reason', 'not_found', 'phase', 'unavailable');
  end if;

  paid := coalesce((
    select sum(coalesce(p.paid_amount, p.amount))::int
    from experience_payments p where p.request_id = r.id and p.status = 'success'
  ), 0);

  if coalesce(r.agreed_total, r.estimated_total) is null then
    return jsonb_build_object('payable', false, 'reason', 'no_total', 'phase', 'unavailable', 'paid', paid);
  end if;

  total := ceil(coalesce(r.agreed_total, r.estimated_total))::int;
  dep := case when r.deposit_percent is null then null
              else least(ceil(total * r.deposit_percent / 100.0)::int, total) end;

  if total - paid <= 0 then
    phase := 'paid'; due := 0;
  elsif dep is not null and paid < dep then
    phase := 'deposit'; due := least(dep - paid, total - paid);
  else
    phase := 'balance'; due := total - paid;
  end if;

  if r.deposit_percent is null then reason := 'not_offered';
  elsif r.customer_id is null then reason := 'no_account';
  elsif phase = 'paid' then reason := 'paid';
  elsif r.status <> 'confirmed' then reason := 'not_confirmed';
  end if;

  return jsonb_build_object(
    'payable', reason is null,
    'reason', reason,
    'phase', phase,
    'total', total,
    'deposit', dep,
    'paid', paid,
    'due_now', due
  );
end;
$$;

revoke all on function experience_amount_due(uuid) from public, anon;
grant execute on function experience_amount_due(uuid) to authenticated;

-- ---------------------------------------------------------
-- Saves the prompt that was just sent (called by api/experience-pay.js with
-- the guest's own session). The amount is recomputed here; the caller's
-- number is ignored.
-- ---------------------------------------------------------
create or replace function record_experience_payment_request(
  p_secret text,
  p_request_id uuid,
  p_phone text,
  p_checkout_request_id text,
  p_merchant_request_id text
)
returns experience_payments
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
  r experience_requests;
  due jsonb;
  result experience_payments;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid secret' using errcode = '42501';
  end if;

  select * into r from experience_requests where id = p_request_id;
  if r.id is null or r.customer_id is distinct from auth.uid() then
    raise exception 'not your request' using errcode = '42501';
  end if;

  due := experience_amount_due(p_request_id);
  if (due->>'payable')::boolean is not true then
    raise exception 'This request can not be paid online right now.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from experience_payments
    where request_id = r.id and status = 'pending' and created_at > now() - interval '90 seconds'
  ) then
    raise exception 'A payment prompt was just sent. Check your phone.' using errcode = 'P0001';
  end if;

  insert into experience_payments (request_id, amount, phone, method, checkout_request_id, merchant_request_id)
  values (r.id, (due->>'due_now')::int, p_phone, 'mpesa', p_checkout_request_id, p_merchant_request_id)
  returning * into result;
  return result;
end;
$$;

revoke all on function record_experience_payment_request(text, uuid, text, text, text) from public, anon;
grant execute on function record_experience_payment_request(text, uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------
-- The M-Pesa result (called by api/pay-callback.js). Only a still-pending
-- payment can be resolved, so a replayed callback changes nothing and the
-- returned row has no id.
-- ---------------------------------------------------------
create or replace function record_experience_payment_result(
  p_secret text,
  p_checkout_request_id text,
  p_result_code int,
  p_result_desc text,
  p_receipt text,
  p_paid_amount int
)
returns experience_payments
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
  result experience_payments;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid callback secret' using errcode = '42501';
  end if;

  update experience_payments
  set status = case when p_result_code = 0 then 'success' else 'failed' end,
      mpesa_receipt = p_receipt,
      result_desc = p_result_desc,
      paid_amount = p_paid_amount
  where checkout_request_id = p_checkout_request_id and status = 'pending'
  returning * into result;

  return result;
end;
$$;

revoke all on function record_experience_payment_result(text, text, int, text, text, int) from public;
grant execute on function record_experience_payment_result(text, text, int, text, text, int) to anon, authenticated;

-- ---------------------------------------------------------
-- Admin: record money received outside M-Pesa prompts (cash, bank, till).
-- ---------------------------------------------------------
create or replace function admin_record_experience_payment(
  p_request_id uuid,
  p_amount int,
  p_method text,
  p_note text default null
)
returns experience_payments
language plpgsql
security definer set search_path = public
as $$
declare
  result experience_payments;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 then
    raise exception 'Enter an amount of at least 1.' using errcode = '23514';
  end if;
  if p_method not in ('cash', 'bank', 'other') then
    raise exception 'Choose cash, bank or other.' using errcode = '23514';
  end if;
  if not exists (select 1 from experience_requests where id = p_request_id) then
    raise exception 'Request not found.' using errcode = 'P0002';
  end if;

  insert into experience_payments (request_id, amount, paid_amount, method, note, status, checkout_request_id)
  values (p_request_id, p_amount, p_amount, p_method, nullif(trim(p_note), ''), 'success', 'manual-' || gen_random_uuid()::text)
  returning * into result;
  return result;
end;
$$;

revoke all on function admin_record_experience_payment(uuid, int, text, text) from public, anon;
grant execute on function admin_record_experience_payment(uuid, int, text, text) to authenticated;

-- ---------------------------------------------------------
-- Email support: what the receipt email needs (called with the server secret).
-- ---------------------------------------------------------
create or replace function experience_payment_context(p_secret text, p_payment_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
  result jsonb;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid secret' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'payment', jsonb_build_object(
      'id', p.id, 'amount', coalesce(p.paid_amount, p.amount), 'receipt', p.mpesa_receipt, 'method', p.method
    ),
    'request', jsonb_build_object(
      'id', r.id, 'experience_title', r.experience_title, 'guest_name', r.guest_name,
      'guest_email', r.guest_email, 'guest_phone', r.guest_phone,
      'preferred_date', r.preferred_date, 'people', r.people,
      'total', case when coalesce(r.agreed_total, r.estimated_total) is null then null
                    else ceil(coalesce(r.agreed_total, r.estimated_total))::int end,
      'paid', coalesce((select sum(coalesce(x.paid_amount, x.amount))::int
                        from experience_payments x where x.request_id = r.id and x.status = 'success'), 0)
    ),
    'business', (
      select jsonb_build_object('name', s.business_name, 'phone', s.contact_phone, 'email', s.contact_email)
      from business_settings s limit 1
    )
  )
  into result
  from experience_payments p
  join experience_requests r on r.id = p.request_id
  where p.id = p_payment_id and p.status = 'success';

  return result;
end;
$$;

revoke all on function experience_payment_context(text, uuid) from public;
grant execute on function experience_payment_context(text, uuid) to anon, authenticated;

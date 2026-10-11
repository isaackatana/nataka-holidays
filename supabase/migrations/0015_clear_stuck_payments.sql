-- =========================================================
-- 0015_clear_stuck_payments.sql
-- Lets an admin clear an M-Pesa prompt that has been "waiting for PIN" for
-- 5+ minutes (the guest dismissed it, or Safaricom's result never arrived),
-- so it stops showing as pending. The admin should first check their M-Pesa
-- statement to confirm no money was taken.
--
-- Safety: if Safaricom's SUCCESS result still arrives later, it is accepted
-- for a payment cleared this way, so a guest who really paid is never left
-- unrecorded. No other finished payment can be changed by a callback.
-- =========================================================

alter table payments
  add column admin_cleared boolean not null default false;

create or replace function admin_clear_stuck_payment(p_payment_id uuid)
returns payments
language plpgsql
security definer set search_path = public
as $$
declare
  result payments;
begin
  if not is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  update payments
  set status = 'failed',
      admin_cleared = true,
      result_desc = 'Cleared by admin: no result received from M-Pesa'
  where id = p_payment_id
    and method = 'mpesa'
    and status = 'pending'
    and created_at <= now() - interval '5 minutes'
  returning * into result;

  if result.id is null then
    raise exception 'not a stuck M-Pesa payment' using errcode = 'P0001';
  end if;

  return result;
end;
$$;

revoke all on function admin_clear_stuck_payment(uuid) from public, anon;
grant execute on function admin_clear_stuck_payment(uuid) to authenticated;

-- Same as 0011, except a SUCCESS result may also resolve a payment an admin
-- cleared. A failure result, or any result for another finished payment, is
-- still ignored.
create or replace function record_mpesa_result(
  p_secret text,
  p_checkout_request_id text,
  p_result_code int,
  p_result_desc text,
  p_receipt text,
  p_paid_amount int
)
returns payments
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
  result payments;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';

  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid callback secret' using errcode = '42501';
  end if;

  update payments
  set status = case when p_result_code = 0 then 'success' else 'failed' end,
      mpesa_receipt = p_receipt,
      result_desc = p_result_desc,
      paid_amount = p_paid_amount,
      admin_cleared = false
  where checkout_request_id = p_checkout_request_id
    and (
      status = 'pending'
      or (status = 'failed' and admin_cleared and p_result_code = 0)
    )
  returning * into result;

  return result;
end;
$$;

-- =========================================================
-- 0011_notifications.sql
-- Support for booking emails (api/notify.js, api/pay-callback.js).
--
-- The email endpoints run without a signed-in user (a guest enquiry has
-- no account), so they read booking details through
-- notification_context(), a security-definer function that refuses to run
-- without the same server-held secret used for M-Pesa
-- (app_secrets.mpesa_callback_secret). notification_log makes each email
-- go out once per booking, so double-clicks and replays don't re-send.
-- =========================================================

create table notification_log (
  booking_id uuid not null references bookings(id) on delete cascade,
  event text not null,
  sent_at timestamptz not null default now(),
  primary key (booking_id, event)
);
alter table notification_log enable row level security;
revoke all on notification_log from anon, authenticated;

create or replace function notification_context(p_secret text, p_booking_id uuid)
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
    'booking', jsonb_build_object(
      'id', b.id,
      'guest_name', b.guest_name,
      'guest_email', b.guest_email,
      'guest_phone', b.guest_phone,
      'check_in', b.check_in,
      'check_out', b.check_out,
      'nights', b.nights,
      'guests', b.guests,
      'message', b.message,
      'estimated_total', b.estimated_total,
      'status', b.status,
      'created_at', b.created_at
    ),
    'property_title', p.title,
    'paid_total', coalesce((
      select sum(coalesce(pay.paid_amount, pay.amount))
      from payments pay where pay.booking_id = b.id and pay.status = 'success'
    ), 0),
    'sent_events', coalesce((
      select jsonb_agg(n.event) from notification_log n where n.booking_id = b.id
    ), '[]'::jsonb),
    'business', (
      select jsonb_build_object(
        'name', s.business_name, 'phone', s.contact_phone, 'email', s.contact_email
      ) from business_settings s limit 1
    )
  )
  into result
  from bookings b
  left join properties p on p.id = b.property_id
  where b.id = p_booking_id;

  return result; -- null when the booking doesn't exist
end;
$$;

create or replace function mark_notification_sent(p_secret text, p_booking_id uuid, p_event text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid secret' using errcode = '42501';
  end if;

  insert into notification_log (booking_id, event)
  values (p_booking_id, p_event)
  on conflict do nothing;
end;
$$;

revoke all on function notification_context(text, uuid) from public;
revoke all on function mark_notification_sent(text, uuid, text) from public;
grant execute on function notification_context(text, uuid) to anon, authenticated;
grant execute on function mark_notification_sent(text, uuid, text) to anon, authenticated;

-- record_mpesa_result now returns the payment row it resolved so the
-- callback can send a receipt. The row has a null id when nothing changed
-- (unknown checkout id, or the payment was already resolved).
drop function record_mpesa_result(text, text, int, text, text, int);

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
      paid_amount = p_paid_amount
  where checkout_request_id = p_checkout_request_id
    and status = 'pending'
  returning * into result;

  return result;
end;
$$;

revoke all on function record_mpesa_result(text, text, int, text, text, int) from public;
grant execute on function record_mpesa_result(text, text, int, text, text, int) to anon, authenticated;

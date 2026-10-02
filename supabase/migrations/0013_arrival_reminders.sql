-- =========================================================
-- 0013_arrival_reminders.sql
-- Support for the daily arrival-reminder email (api/send-reminders.js).
--   * notification_context now also returns the property's arrival details
--     (location, map coordinates, check-in/out times, house rules).
--   * bookings_due_reminder lists confirmed bookings arriving soon that
--     haven't had a reminder yet. Both need the same server-held secret as
--     the other email functions.
-- =========================================================

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
    'property', jsonb_build_object(
      'location', p.location,
      'latitude', p.latitude,
      'longitude', p.longitude,
      'check_in_time', p.check_in_time,
      'check_out_time', p.check_out_time,
      'house_rules', p.house_rules
    ),
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

  return result;
end;
$$;

create or replace function bookings_due_reminder(p_secret text, p_from date, p_to date)
returns uuid[]
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

  return coalesce((
    select array_agg(b.id order by b.check_in)
    from bookings b
    where b.status = 'confirmed'
      and b.check_in between p_from and p_to
      and not exists (
        select 1 from notification_log n where n.booking_id = b.id and n.event = 'reminder'
      )
  ), '{}');
end;
$$;

revoke all on function bookings_due_reminder(text, date, date) from public;
grant execute on function bookings_due_reminder(text, date, date) to anon, authenticated;

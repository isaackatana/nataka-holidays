-- =========================================================
-- 0019_review_requests.sql
-- Support for the "How was your stay?" email (sent by the same daily job
-- as arrival reminders, api/send-reminders.js).
--
-- bookings_due_review_request lists COMPLETED stays that ended inside the
-- given date range, belong to a signed-in guest (only they can write a
-- review), have not had this email yet, and have no review yet.
-- Needs the same server-held secret as the other email functions.
-- =========================================================

create or replace function bookings_due_review_request(p_secret text, p_from date, p_to date)
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
    select array_agg(b.id order by b.check_out)
    from bookings b
    where b.status = 'completed'
      and b.customer_id is not null
      and b.check_out between p_from and p_to
      and not exists (
        select 1 from notification_log n where n.booking_id = b.id and n.event = 'review_request'
      )
      and not exists (
        select 1 from reviews r where r.booking_id = b.id
      )
  ), '{}');
end;
$$;

revoke all on function bookings_due_review_request(text, date, date) from public;
grant execute on function bookings_due_review_request(text, date, date) to anon, authenticated;

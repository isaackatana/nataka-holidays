-- =========================================================
-- 0009_customer_payments.sql
-- Lets a signed-in guest pay for their own confirmed booking.
--
-- Customers still have NO insert permission on payments. api/pay-request.js
-- checks ownership, booking status and amount limits, sends the STK
-- prompt, and then records it through this function, which refuses to run
-- without the server-held secret (same one record_mpesa_result uses).
-- A customer calling the API directly therefore can't create payment rows.
-- =========================================================

create or replace function record_mpesa_request(
  p_secret text,
  p_booking_id uuid,
  p_amount int,
  p_phone text,
  p_checkout_request_id text,
  p_merchant_request_id text
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
    raise exception 'invalid secret' using errcode = '42501';
  end if;

  insert into payments (booking_id, amount, phone, checkout_request_id, merchant_request_id)
  values (p_booking_id, p_amount, p_phone, p_checkout_request_id, p_merchant_request_id)
  returning * into result;

  return result;
end;
$$;

revoke all on function record_mpesa_request(text, uuid, int, text, text, text) from public;
grant execute on function record_mpesa_request(text, uuid, int, text, text, text) to anon, authenticated;

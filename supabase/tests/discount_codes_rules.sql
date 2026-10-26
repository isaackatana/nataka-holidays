-- Checks migration 0030 (shop discount codes) on a scratch database.
-- Run after all migrations. Self-contained: makes its own guests and product.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('d1d1d1d1-0000-0000-0000-00000000000a', 'guest-a@example.com', '{"full_name":"Guest A"}'),
  ('d1d1d1d1-0000-0000-0000-00000000000b', 'guest-b@example.com', '{"full_name":"Guest B"}')
on conflict do nothing;
insert into app_secrets (key, value) values ('mpesa_callback_secret', 'test-secret-123')
on conflict (key) do update set value = excluded.value;
insert into business_settings (business_name) select 'Nataka Holidays' where not exists (select 1 from business_settings);
update business_settings set shop_delivery_fee = 300;
insert into products (id, name, slug, price, stock) values
  ('f1000000-0000-0000-0000-000000000001', 'Discount test item', 'disc-test', 1000, 50);

insert into discount_codes (code, kind, value, min_subtotal, max_uses, once_per_guest, expires_at, is_active) values
  ('TEN',     'percent', 10,  0,    null, true,  null, true),
  ('BIG',     'amount',  5000, 0,   null, false, null, true),
  ('MIN3K',   'amount',  100, 3000, null, true,  null, true),
  ('ONEONLY', 'amount',  100, 0,    1,    false, null, true),
  ('OLD',     'percent', 10,  0,    null, true,  now() - interval '1 day', true),
  ('OFF',     'percent', 10,  0,    null, true,  null, false);

create temp table t_a1 (id uuid);
create temp table t_cancel_me (id uuid);
grant all on t_a1 to public;

create or replace function pg_temp.order_as(guest text, qty int, fulfil text, code text)
returns orders language plpgsql as $$
declare o orders;
begin
  -- Test housekeeping only: earlier test orders count as paid so the "3 unpaid orders" limit never gets in the way.
  update orders set status = 'paid' where customer_id = guest::uuid and status = 'pending_payment'
    and id not in (select id from t_a1) and id not in (select id from pg_temp.t_cancel_me);
  perform set_config('request.jwt.claim.sub', guest, false);
  execute 'set local role authenticated';
  o := create_order(
    jsonb_build_array(jsonb_build_object('product_id', 'f1000000-0000-0000-0000-000000000001', 'quantity', qty)),
    fulfil, 'Guest', '254712345678',
    case when fulfil = 'handover' then 'Room 4' end,
    case when fulfil = 'delivery' then '12 Beach Road' end,
    code);
  execute 'reset role';
  return o;
exception when others then
  execute 'reset role';
  raise;
end $$;

\set A '''d1d1d1d1-0000-0000-0000-00000000000a'''
\set B '''d1d1d1d1-0000-0000-0000-00000000000b'''

do $$ declare o orders; begin
  o := pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000a', 2, 'handover', 'ten');
  assert o.subtotal = 2000 and o.discount_amount = 200 and o.total = 1800 and o.discount_code = 'TEN', 'ten percent off';
  assert (select uses from discount_codes where code = 'TEN') = 1, 'use counted';
  raise notice 'D01 ok: code "ten" (any case) takes 10%% off 2000 -> total %, use counted', o.total;
  insert into t_a1 select o.id;
end $$;

do $$ declare o orders; begin
  o := pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000b', 2, 'delivery', 'TEN');
  assert o.total = 2000 - 200 + 300, 'delivery fee is not discounted';
  raise notice 'D02 ok: delivery fee (300) is added after the discount: total %', o.total;
end $$;

do $$ begin
  begin
    perform pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000a', 1, 'handover', 'TEN');
    raise exception 'should have failed';
  exception when others then assert sqlerrm like 'You have already used%', sqlerrm; end;
  raise notice 'D03 ok: a once-per-guest code cannot be used twice by the same guest';
end $$;

do $$ begin
  perform pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000a', 1, 'handover', 'BIG');
  raise notice 'D04 ok: a code can be allowed more than once per guest';
end $$;

do $$ declare o orders; begin
  o := pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000b', 1, 'handover', 'BIG');
  assert o.discount_amount = 999 and o.total = 1, 'never free';
  raise notice 'D05 ok: a KSh 5000 code on a KSh 1000 order leaves KSh % to pay (never free)', o.total;
end $$;

do $$ begin
  begin
    perform pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000a', 2, 'handover', 'MIN3K');
    raise exception 'should have failed';
  exception when others then assert sqlerrm like 'This code needs at least KSh 3000%', sqlerrm; end;
  perform pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000a', 3, 'handover', 'MIN3K');
  raise notice 'D06 ok: the minimum spend is enforced';
end $$;

do $$ declare o orders; begin
  o := pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000a', 1, 'handover', 'ONEONLY');
  insert into t_cancel_me select o.id;
  begin
    perform pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000b', 1, 'handover', 'ONEONLY');
    raise exception 'should have failed';
  exception when others then assert sqlerrm like 'That code has been fully used%', sqlerrm; end;
  perform set_config('request.jwt.claim.sub', 'd1d1d1d1-0000-0000-0000-00000000000a', false);
  execute 'set local role authenticated';
  perform cancel_order(o.id);
  execute 'reset role';
  assert (select uses from discount_codes where code = 'ONEONLY') = 0, 'use given back on cancel';
  perform pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000b', 1, 'handover', 'ONEONLY');
  raise notice 'D07 ok: a one-use code is used up, and available again if that order is cancelled';
end $$;

do $$ begin
  begin perform pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000a', 1, 'handover', 'OLD'); raise exception 'should have failed';
  exception when others then assert sqlerrm like 'That code is not valid%', sqlerrm; end;
  begin perform pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000a', 1, 'handover', 'OFF'); raise exception 'should have failed';
  exception when others then assert sqlerrm like 'That code is not valid%', sqlerrm; end;
  begin perform pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000a', 1, 'handover', 'NOPE'); raise exception 'should have failed';
  exception when others then assert sqlerrm like 'That code is not valid%', sqlerrm; end;
  raise notice 'D08 ok: expired, switched-off and made-up codes are all refused the same way';
end $$;

do $$ declare o orders; begin
  o := pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000a', 1, 'handover', null);
  assert o.discount_amount = 0 and o.discount_code is null and o.total = 1000;
  o := pg_temp.order_as('d1d1d1d1-0000-0000-0000-00000000000b', 1, 'handover', '   ');
  assert o.discount_amount = 0 and o.total = 1000;
  raise notice 'D09 ok: orders without a code are unchanged';
end $$;

-- Expiry gives the use back; money arriving late takes it again
do $$ begin
  update orders set expires_at = now() - interval '1 minute' where id = (select id from t_a1);
  perform set_config('request.jwt.claim.sub', '', false);
  perform release_expired_orders();
  assert (select status from orders where id = (select id from t_a1)) = 'expired';
  assert (select uses from discount_codes where code = 'TEN') = 1, 'one TEN use left (guest B)';
  raise notice 'D10 ok: an unpaid order that expires gives its code use back';
end $$;
insert into order_payments (order_id, amount, phone, checkout_request_id)
select id, 1800, '254712345678', 'ws_CO_disc_test' from t_a1;
select record_order_payment_result('test-secret-123', 'ws_CO_disc_test', 0, 'ok', 'RCPTD', 1800);
do $$ begin
  assert (select status from orders where id = (select id from t_a1)) = 'paid';
  assert (select uses from discount_codes where code = 'TEN') = 2, 'use taken again';
  raise notice 'D11 ok: money arriving after expiry marks it paid and counts the code use again';
end $$;

-- The checkout box: answers without placing anything, and slows guessing
do $$ declare r jsonb; begin
  perform set_config('request.jwt.claim.sub', 'd1d1d1d1-0000-0000-0000-00000000000b', false);
  execute 'set local role authenticated';
  r := check_discount_code('big', 1500);
  assert (r->>'ok')::boolean and (r->>'amount')::int = 1499, r::text;
  r := check_discount_code('MIN3K', 1000);
  assert not (r->>'ok')::boolean and r->>'message' like 'This code needs at least%', r::text;
  for i in 1..9 loop perform check_discount_code('GUESS' || i, 1000); end loop;
  r := check_discount_code('BIG', 1500);
  assert not (r->>'ok')::boolean and r->>'message' like 'Too many tries%', r::text;
  execute 'reset role';
  raise notice 'D12 ok: the box previews the discount, and 10 wrong guesses lock it for a few minutes';
end $$;

-- Guests and visitors cannot read the codes; the e-mail data carries the discount
set role authenticated;
select set_config('request.jwt.claim.sub', 'd1d1d1d1-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from discount_codes) = 0, 'guest sees no codes';
  raise notice 'D13 ok: guests cannot list the discount codes';
end $$;
reset role;
do $$ declare ctx jsonb; begin
  ctx := order_notification_context('test-secret-123', (select id from t_a1));
  assert ctx->'order'->>'discount_code' = 'TEN' and (ctx->'order'->>'discount_amount')::int = 200, ctx::text;
  raise notice 'D14 ok: the order e-mail data includes the discount';
end $$;

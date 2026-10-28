-- Checks migration 0033 (gift wrap) on a scratch database. Run after all migrations.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('d4d4d4d4-0000-0000-0000-00000000000a', 'gw-a@example.com', '{"full_name":"Gift Guest"}')
on conflict do nothing;
insert into app_secrets (key, value) values ('mpesa_callback_secret', 'test-secret-123')
on conflict (key) do update set value = excluded.value;
insert into business_settings (business_name) select 'Nataka Holidays' where not exists (select 1 from business_settings);
update business_settings set shop_delivery_fee = 300, shop_gift_wrap_fee = 0;
insert into products (id, name, slug, price, stock) values ('f4000000-0000-0000-0000-000000000001', 'Gift test item', 'gw-item', 1000, 50);
insert into discount_codes (code, kind, value, once_per_guest) values ('GWTEN', 'percent', 10, false);

create temp table t_ids (id uuid);
create or replace function pg_temp.place(wrap boolean, msg text, code text default null, fulfil text default 'handover')
returns orders language plpgsql as $$
declare o orders;
begin
  update orders set status = 'paid' where customer_id = 'd4d4d4d4-0000-0000-0000-00000000000a' and status = 'pending_payment';
  perform set_config('request.jwt.claim.sub', 'd4d4d4d4-0000-0000-0000-00000000000a', false);
  execute 'set local role authenticated';
  o := create_order(
    '[{"product_id":"f4000000-0000-0000-0000-000000000001","quantity":2}]'::jsonb,
    fulfil, 'Gift Guest', '254712345678',
    case when fulfil = 'handover' then 'Room 4' end,
    case when fulfil = 'delivery' then '12 Beach Road' end,
    code, wrap, msg);
  execute 'reset role';
  return o;
exception when others then execute 'reset role'; raise;
end $$;

do $$ begin
  begin perform pg_temp.place(true, 'Happy birthday'); raise exception 'should have failed';
  exception when others then assert sqlerrm like 'Gift wrapping is not available%', sqlerrm; end;
  raise notice 'G01 ok: while the fee is 0, wrapping is not offered and cannot be switched on from the browser';
end $$;

update business_settings set shop_gift_wrap_fee = 250;

do $$ declare o orders; begin
  o := pg_temp.place(true, '  Happy birthday, Amina!  ');
  assert o.gift_wrap and o.gift_wrap_fee = 250 and o.gift_message = 'Happy birthday, Amina!', 'wrap recorded and message trimmed';
  assert o.total = 2000 + 250, 'fee added';
  insert into t_ids values (o.id);
  raise notice 'G02 ok: gift wrap adds KSh 250 (total %), message is kept trimmed', o.total;
end $$;

do $$ declare o orders; begin
  o := pg_temp.place(false, 'sneaky message');
  assert not o.gift_wrap and o.gift_wrap_fee = 0 and o.gift_message is null and o.total = 2000, 'no wrap, no fee, no message';
  raise notice 'G03 ok: without wrapping there is no fee and any message is dropped';
end $$;

do $$ declare o orders; begin
  o := pg_temp.place(true, null, 'GWTEN', 'delivery');
  assert o.discount_amount = 200 and o.total = 2000 - 200 + 300 + 250, 'discount only on items; delivery and wrap added after';
  assert o.gift_message is null, 'empty message is null';
  raise notice 'G04 ok: a discount code takes 10%% off the items only; delivery and gift wrap are added after (total %)', o.total;
end $$;

do $$ begin
  begin perform pg_temp.place(true, repeat('x', 201)); raise exception 'should have failed';
  exception when others then assert sqlerrm like 'Keep the gift message under 200%', sqlerrm; end;
  raise notice 'G05 ok: a gift message over 200 characters is refused';
end $$;

do $$ declare ctx jsonb; begin
  ctx := order_notification_context('test-secret-123', (select id from t_ids limit 1));
  assert (ctx->'order'->>'gift_wrap')::boolean and (ctx->'order'->>'gift_wrap_fee')::int = 250 and ctx->'order'->>'gift_message' = 'Happy birthday, Amina!', ctx::text;
  raise notice 'G06 ok: the order e-mail data carries the gift wrap and message';
end $$;

-- cancelling an order keeps working with the new columns
do $$ declare o orders; begin
  o := pg_temp.place(true, 'bye');
  perform set_config('request.jwt.claim.sub', 'd4d4d4d4-0000-0000-0000-00000000000a', false);
  execute 'set local role authenticated';
  perform cancel_order(o.id);
  execute 'reset role';
  assert (select status from orders where id = o.id) = 'cancelled';
  raise notice 'G07 ok: orders with gift wrap can still be cancelled';
end $$;

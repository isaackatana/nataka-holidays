-- Checks migration 0028 (shop colour / option choices) on a scratch database.
-- Run after the other migrations (see README.md). Each line says what was
-- tested; a failed check stops the script with an ERROR.
\set ON_ERROR_STOP on
\set U '''d0d0d0d0-0000-0000-0000-0000000000a1'''

insert into auth.users (id, email, raw_user_meta_data)
values (:U, 'shopper@example.com', '{"full_name":"Shopper"}')
on conflict do nothing;
insert into app_secrets (key, value) values ('mpesa_callback_secret', 'test-secret-123')
on conflict (key) do update set value = excluded.value;
insert into business_settings (business_name)
select 'Nataka Holidays' where not exists (select 1 from business_settings);

insert into products (id, name, slug, price, stock) values
  ('b1000000-0000-0000-0000-000000000001', 'Kikoy cloth', 'kikoy-test', 1500, 0),
  ('b1000000-0000-0000-0000-000000000002', 'Sisal basket', 'basket-test', 800, 4),
  ('b1000000-0000-0000-0000-000000000003', 'Hidden thing', 'hidden-test', 500, 9);
update products set is_active = false where slug = 'hidden-test';

insert into product_variants (id, product_id, name, stock, sort_order) values
  ('c1000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000001', 'Blue', 3, 0),
  ('c1000000-0000-0000-0000-00000000000c', 'b1000000-0000-0000-0000-000000000001', 'Red', 2, 1),
  ('c1000000-0000-0000-0000-00000000000d', 'b1000000-0000-0000-0000-000000000003', 'Green', 5, 0);

do $$ begin
  assert (select stock from products where slug = 'kikoy-test') = 5, 'product stock = total of options';
  raise notice 'T01 ok: a product with options shows the total of its options as its stock';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', 'd0d0d0d0-0000-0000-0000-0000000000a1', false);

do $$
declare o orders; n text; v text;
begin
  o := create_order('[{"product_id":"b1000000-0000-0000-0000-000000000001","variant_id":"c1000000-0000-0000-0000-00000000000b","quantity":2}]'::jsonb,
                    'handover', 'Shopper', '254712345678', 'Room 4', null);
  assert o.total = 3000, 'total priced by the database';
  select product_name, variant_name into n, v from order_items where order_id = o.id;
  assert n = 'Kikoy cloth (Blue)' and v = 'Blue', 'order line names the option';
  raise notice 'T02 ok: ordering 2 Blue priced at 3000, line reads "%"', n;
end $$;

reset role;
do $$ begin
  assert (select stock from product_variants where name = 'Blue') = 1, 'blue reserved';
  assert (select stock from products where slug = 'kikoy-test') = 3, 'product total follows';
  raise notice 'T03 ok: Blue stock 3 -> 1, product total 5 -> 3';
end $$;
set role authenticated;

do $$ begin
  begin
    perform create_order('[{"product_id":"b1000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb, 'handover', 'Shopper', '254712345678', 'Room 4', null);
    raise exception 'should have failed';
  exception when others then
    assert sqlerrm like 'Choose an option%', sqlerrm;
  end;
  raise notice 'T04 ok: a product with options cannot be ordered without choosing one';
end $$;

do $$ begin
  begin
    perform create_order('[{"product_id":"b1000000-0000-0000-0000-000000000001","variant_id":"c1000000-0000-0000-0000-00000000000b","quantity":2}]'::jsonb, 'handover', 'Shopper', '254712345678', 'Room 4', null);
    raise exception 'should have failed';
  exception when others then
    assert sqlerrm like 'Only 1 left of Kikoy cloth (Blue)%', sqlerrm;
  end;
  raise notice 'T05 ok: cannot order more of an option than is left';
end $$;

do $$ begin
  begin
    perform create_order('[{"product_id":"b1000000-0000-0000-0000-000000000002","variant_id":"c1000000-0000-0000-0000-00000000000b","quantity":1}]'::jsonb, 'handover', 'Shopper', '254712345678', 'Room 4', null);
    raise exception 'should have failed';
  exception when others then
    assert sqlerrm like 'An option in your cart%', sqlerrm;
  end;
  raise notice 'T06 ok: an option of a different product, or an option on a plain product, is refused';
end $$;

do $$ declare o orders; begin
  o := create_order('[{"product_id":"b1000000-0000-0000-0000-000000000002","quantity":3}]'::jsonb, 'delivery', 'Shopper', '254712345678', null, '12 Beach Road');
  assert (select stock from products where slug = 'basket-test') = 1, 'plain stock reserved';
  perform cancel_order(o.id);
  assert (select stock from products where slug = 'basket-test') = 4, 'plain stock returned';
  raise notice 'T07 ok: a product without options still works (reserve, then cancel gives it back)';
end $$;

do $$ declare o orders; begin
  o := create_order('[{"product_id":"b1000000-0000-0000-0000-000000000001","variant_id":"c1000000-0000-0000-0000-00000000000c","quantity":2}]'::jsonb, 'handover', 'Shopper', '254712345678', 'Room 4', null);
  perform cancel_order(o.id);
  reset role;
  assert (select stock from product_variants where name = 'Red') = 2, 'red returned';
  assert (select stock from products where slug = 'kikoy-test') = 3, 'total returned';
  raise notice 'T08 ok: cancelling gives the option''s stock back';
end $$;

set role authenticated;
do $$ declare o orders; begin
  o := create_order('[{"product_id":"b1000000-0000-0000-0000-000000000001","variant_id":"c1000000-0000-0000-0000-00000000000c","quantity":2}]'::jsonb, 'handover', 'Shopper', '254712345678', 'Room 4', null);
  create temp table t_order as select o.id as id;
  grant all on t_order to public;
end $$;
reset role;
update orders set expires_at = now() - interval '1 minute' where id = (select id from t_order);
set role anon;
select release_expired_orders();
reset role;
do $$ begin
  assert (select status from orders where id = (select id from t_order)) = 'expired';
  assert (select stock from product_variants where name = 'Red') = 2, 'red returned on expiry';
  raise notice 'T09 ok: an unpaid order that expires gives the option''s stock back';
end $$;

insert into order_payments (order_id, amount, phone, checkout_request_id)
select id, 3000, '254712345678', 'ws_CO_variant_test' from t_order;
select record_order_payment_result('test-secret-123', 'ws_CO_variant_test', 0, 'ok', 'RCPT1', 3000);
do $$ begin
  assert (select status from orders where id = (select id from t_order)) = 'paid';
  assert (select stock from product_variants where name = 'Red') = 0, 'red taken again';
  assert (select stock from products where slug = 'kikoy-test') = 1, 'total follows';
  raise notice 'T10 ok: money arriving after expiry marks it paid and takes the option''s stock again';
end $$;

set role anon;
do $$ begin
  assert (select count(*) from product_variants where name in ('Blue', 'Red')) = 2, 'public sees options of shown products';
  assert (select count(*) from product_variants where name = 'Green') = 0, 'public does not see options of hidden products';
  raise notice 'T11 ok: the public sees options only for products that are shown';
end $$;
do $$ begin
  begin
    update product_variants set stock = 99;
    assert (select count(*) from product_variants where stock = 99) = 0;
  exception when others then null;
  end;
  raise notice 'T12 ok: the public cannot change an option''s stock';
end $$;
reset role;

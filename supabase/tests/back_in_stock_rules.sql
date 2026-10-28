-- Checks migration 0032 (back-in-stock requests) on a scratch database. Run after all migrations.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('d3d3d3d3-0000-0000-0000-00000000000a', 'bis-a@example.com', '{"full_name":"Amina Hassan"}'),
  ('d3d3d3d3-0000-0000-0000-00000000000b', 'bis-b@example.com', '{"full_name":"Joe Mwangi"}'),
  ('d3d3d3d3-0000-0000-0000-0000000000ad', 'bis-owner@example.com', '{"full_name":"Owner"}')
on conflict do nothing;
update profiles set role = 'admin' where id = 'd3d3d3d3-0000-0000-0000-0000000000ad';
insert into app_secrets (key, value) values ('mpesa_callback_secret', 'test-secret-123')
on conflict (key) do update set value = excluded.value;
insert into business_settings (business_name) select 'Nataka Holidays' where not exists (select 1 from business_settings);

insert into products (id, name, slug, price, stock, is_active) values
  ('a3000000-0000-0000-0000-000000000001', 'Sold out basket', 'bis-basket', 800, 0, true),
  ('a3000000-0000-0000-0000-000000000002', 'In stock bowl', 'bis-bowl', 500, 5, true),
  ('a3000000-0000-0000-0000-000000000003', 'Kikoy', 'bis-kikoy', 1500, 0, true),
  ('a3000000-0000-0000-0000-000000000004', 'Hidden thing', 'bis-hidden', 100, 0, false);
insert into product_variants (id, product_id, name, stock) values
  ('c3000000-0000-0000-0000-00000000000b', 'a3000000-0000-0000-0000-000000000003', 'Blue', 0),
  ('c3000000-0000-0000-0000-00000000000c', 'a3000000-0000-0000-0000-000000000003', 'Red', 4);

set role authenticated;
select set_config('request.jwt.claim.sub', 'd3d3d3d3-0000-0000-0000-00000000000a', false);

do $$ begin
  insert into back_in_stock_requests (customer_id, product_id)
  values ('d3d3d3d3-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001');
  insert into back_in_stock_requests (customer_id, product_id, variant_id)
  values ('d3d3d3d3-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-00000000000b');
  raise notice 'B01 ok: a guest can wait for a sold-out product and a sold-out colour';
end $$;

do $$ declare msgs text[] := '{}'; begin
  begin insert into back_in_stock_requests (customer_id, product_id) values ('d3d3d3d3-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000002'); exception when others then msgs := msgs || sqlerrm; end;
  begin insert into back_in_stock_requests (customer_id, product_id, variant_id) values ('d3d3d3d3-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-00000000000c'); exception when others then msgs := msgs || sqlerrm; end;
  begin insert into back_in_stock_requests (customer_id, product_id) values ('d3d3d3d3-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000003'); exception when others then msgs := msgs || sqlerrm; end;
  begin insert into back_in_stock_requests (customer_id, product_id) values ('d3d3d3d3-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000004'); exception when others then msgs := msgs || sqlerrm; end;
  assert array_length(msgs, 1) = 4, 'all four refused: ' || msgs::text;
  assert msgs[1] like '%in stock right now%' and msgs[2] like '%in stock right now%' and msgs[3] like 'Choose a colour%' and msgs[4] like '%not available%', msgs::text;
  raise notice 'B02 ok: refused when it is in stock, when a colour is missing, or when the product is hidden';
end $$;

do $$ begin
  begin insert into back_in_stock_requests (customer_id, product_id) values ('d3d3d3d3-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001'); raise exception 'should fail';
  exception when unique_violation then null; end;
  raise notice 'B03 ok: asking twice for the same item is refused';
end $$;

select set_config('request.jwt.claim.sub', 'd3d3d3d3-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from back_in_stock_requests) = 0, 'other guest sees none of A''s requests';
  begin
    insert into back_in_stock_requests (customer_id, product_id) values ('d3d3d3d3-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001'); raise exception 'should fail';
  exception when others then assert sqlerrm like '%row-level security%' or sqlerrm like '%duplicate%', sqlerrm; end;
  delete from back_in_stock_requests;
  raise notice 'B04 ok: a guest cannot see, add for, or remove another guest''s requests';
end $$;
select set_config('request.jwt.claim.sub', 'd3d3d3d3-0000-0000-0000-0000000000ad', false);
do $$ begin
  assert (select count(*) from back_in_stock_requests) = 2, 'the owner sees what is waiting';
  raise notice 'B05 ok: the owner can see the waiting requests (2)';
end $$;
reset role;

do $$ declare r jsonb; begin
  r := back_in_stock_due('test-secret-123');
  assert jsonb_array_length(r->'guests') = 0, 'nothing due while sold out';
  update products set stock = 6 where slug = 'bis-basket';
  r := back_in_stock_due('test-secret-123');
  assert jsonb_array_length(r->'guests') = 1, 'one guest due';
  assert r->'guests'->0->>'email' = 'bis-a@example.com' and r->'guests'->0->>'name' = 'Amina Hassan', r::text;
  assert jsonb_array_length(r->'guests'->0->'items') = 1 and r->'guests'->0->'items'->0->>'name' = 'Sold out basket', r::text;
  update product_variants set stock = 3 where name = 'Blue';
  r := back_in_stock_due('test-secret-123');
  assert jsonb_array_length(r->'guests'->0->'items') = 2, 'both items listed in one guest entry';
  assert exists (select 1 from jsonb_array_elements(r->'guests'->0->'items') i where i->>'option' = 'Blue'), r::text;
  raise notice 'B06 ok: a guest is due only once something is back, and gets one entry listing everything that is back';
end $$;

do $$ declare r jsonb; ids uuid[]; begin
  r := back_in_stock_due('test-secret-123');
  select array_agg((i->>'request_id')::uuid) into ids from jsonb_array_elements(r->'guests'->0->'items') i;
  perform mark_back_in_stock_notified('test-secret-123', ids);
  assert (select count(*) from back_in_stock_requests) = 0, 'requests removed';
  assert jsonb_array_length(back_in_stock_due('test-secret-123')->'guests') = 0;
  raise notice 'B07 ok: once e-mailed, the requests are removed, so nobody is e-mailed twice';
end $$;

do $$ begin
  begin perform back_in_stock_due('wrong'); raise exception 'should fail'; exception when others then assert sqlerrm = 'invalid secret'; end;
  begin perform mark_back_in_stock_notified('wrong', '{}'); raise exception 'should fail'; exception when others then assert sqlerrm = 'invalid secret'; end;
  raise notice 'B08 ok: both functions refuse a wrong secret';
end $$;

do $$ declare n int; begin
  update products set stock = 0 where slug in ('bis-basket');
  for n in 1..20 loop
    insert into products (name, slug, price, stock) values ('Cap ' || n, 'bis-cap-' || n, 100, 0);
  end loop;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'd3d3d3d3-0000-0000-0000-00000000000b', false);
  for n in 1..20 loop
    insert into back_in_stock_requests (customer_id, product_id)
    select 'd3d3d3d3-0000-0000-0000-00000000000b', id from products where slug = 'bis-cap-' || n;
  end loop;
  begin
    insert into back_in_stock_requests (customer_id, product_id) values ('d3d3d3d3-0000-0000-0000-00000000000b', 'a3000000-0000-0000-0000-000000000001'); raise exception 'should fail';
  exception when others then assert sqlerrm like 'You are already waiting for 20%', sqlerrm; end;
  reset role;
  raise notice 'B09 ok: at most 20 waiting requests per guest';
end $$;

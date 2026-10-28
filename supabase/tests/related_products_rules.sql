-- Checks migration 0034 (related products) on a scratch database. Run after all migrations.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('d5d5d5d5-0000-0000-0000-00000000000a', 'rp-a@example.com', '{"full_name":"A"}')
on conflict do nothing;

insert into products (id, name, slug, price, stock, category, is_active, created_at) values
  ('a5000000-0000-0000-0000-000000000001', 'Cart item',      'rp-cart',    100, 5, 'Textiles', true,  now() - interval '10 days'),
  ('a5000000-0000-0000-0000-000000000002', 'Often with it',  'rp-often',   100, 5, 'Kitchen',  true,  now() - interval '9 days'),
  ('a5000000-0000-0000-0000-000000000003', 'Once with it',   'rp-once',    100, 5, 'Baskets',  true,  now() - interval '8 days'),
  ('a5000000-0000-0000-0000-000000000004', 'Same category',  'rp-samecat', 100, 5, 'Textiles', true,  now() - interval '7 days'),
  ('a5000000-0000-0000-0000-000000000005', 'Newest other',   'rp-newest',  100, 5, 'Jewellery',true,  now() - interval '1 day'),
  ('a5000000-0000-0000-0000-000000000006', 'Sold out pal',   'rp-soldout', 100, 0, 'Kitchen',  true,  now()),
  ('a5000000-0000-0000-0000-000000000007', 'Hidden pal',     'rp-hidden',  100, 5, 'Kitchen',  false, now()),
  ('a5000000-0000-0000-0000-000000000008', 'Unpaid pal',     'rp-unpaid',  100, 5, 'Kitchen',  true,  now() - interval '20 days');

-- Paid orders: cart item + often (x2), cart item + once, cart item + sold-out + hidden; one UNPAID order with the "unpaid pal"
insert into orders (id, customer_id, customer_name, customer_phone, fulfilment, handover_note, subtotal, delivery_fee, total, status) values
  ('e5000000-0000-0000-0000-000000000001', 'd5d5d5d5-0000-0000-0000-00000000000a', 'Amina Test', '254712345678', 'handover', 'Room 4', 100, 0, 100, 'paid'),
  ('e5000000-0000-0000-0000-000000000002', 'd5d5d5d5-0000-0000-0000-00000000000a', 'Amina Test', '254712345678', 'handover', 'Room 4', 100, 0, 100, 'completed'),
  ('e5000000-0000-0000-0000-000000000003', 'd5d5d5d5-0000-0000-0000-00000000000a', 'Amina Test', '254712345678', 'handover', 'Room 4', 100, 0, 100, 'packed'),
  ('e5000000-0000-0000-0000-000000000004', 'd5d5d5d5-0000-0000-0000-00000000000a', 'Amina Test', '254712345678', 'handover', 'Room 4', 100, 0, 100, 'paid'),
  ('e5000000-0000-0000-0000-000000000005', 'd5d5d5d5-0000-0000-0000-00000000000a', 'Amina Test', '254712345678', 'handover', 'Room 4', 100, 0, 100, 'pending_payment');
insert into order_items (order_id, product_id, product_name, unit_price, quantity) values
  ('e5000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'Cart item', 100, 1),
  ('e5000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002', 'Often with it', 100, 1),
  ('e5000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000001', 'Cart item', 100, 1),
  ('e5000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000002', 'Often with it', 100, 3),
  ('e5000000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-000000000001', 'Cart item', 100, 1),
  ('e5000000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-000000000003', 'Once with it', 100, 1),
  ('e5000000-0000-0000-0000-000000000004', 'a5000000-0000-0000-0000-000000000001', 'Cart item', 100, 1),
  ('e5000000-0000-0000-0000-000000000004', 'a5000000-0000-0000-0000-000000000006', 'Sold out pal', 100, 1),
  ('e5000000-0000-0000-0000-000000000004', 'a5000000-0000-0000-0000-000000000007', 'Hidden pal', 100, 1),
  ('e5000000-0000-0000-0000-000000000005', 'a5000000-0000-0000-0000-000000000001', 'Cart item', 100, 1),
  ('e5000000-0000-0000-0000-000000000005', 'a5000000-0000-0000-0000-000000000008', 'Unpaid pal', 100, 1);

create or replace function pg_temp.names(ids uuid[], lim int default 4) returns text language sql as $$
  select string_agg(p.name || ':' || r.together, ' | ' order by ord)
  from (select product_id, together, row_number() over () as ord from related_products(ids, lim)) r
  join products p on p.id = r.product_id
$$;

do $$ declare s text; begin
  s := pg_temp.names(array['a5000000-0000-0000-0000-000000000001']::uuid[], 8);
  assert s like 'Often with it:2 | Once with it:1 | Same category:0 | Newest other:0%', s;
  raise notice 'R01 ok: ranked by how often bought together, then same category, then newest -> %', s;
end $$;

do $$ declare s text; begin
  s := pg_temp.names(array['a5000000-0000-0000-0000-000000000001']::uuid[], 8);
  assert s not like '%Cart item%' and s not like '%Sold out%' and s not like '%Hidden%', s;
  assert s not like '%Unpaid pal:%' or s like '%Unpaid pal:0%', 'unpaid orders do not count as bought together: ' || s;
  raise notice 'R02 ok: never the cart item, sold-out or hidden products; unpaid orders are not counted as "bought together"';
end $$;

do $$ declare s text; begin
  s := pg_temp.names(array['a5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000002']::uuid[], 8);
  assert s not like '%Often with it%' and s not like '%Cart item%', s;
  raise notice 'R03 ok: with two cart items, neither is suggested back: %', s;
end $$;

do $$ declare n int; begin
  select count(*) into n from related_products(array['a5000000-0000-0000-0000-000000000001']::uuid[], 2);
  assert n = 2;
  select count(*) into n from related_products(array['a5000000-0000-0000-0000-000000000001']::uuid[], 100);
  assert n <= 8, 'limit is capped at 8';
  select count(*) into n from related_products('{}'::uuid[], 4);
  assert n > 0, 'with an empty cart it still suggests in-stock products';
  raise notice 'R04 ok: the limit is respected and capped at 8';
end $$;

set role anon;
do $$ declare n int; begin
  select count(*) into n from related_products(array['a5000000-0000-0000-0000-000000000001']::uuid[], 4);
  assert n = 4, 'visitors can use it';
  raise notice 'R05 ok: visitors who are not signed in can use it';
end $$;
reset role;

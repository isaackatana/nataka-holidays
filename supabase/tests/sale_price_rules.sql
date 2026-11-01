-- Checks migration 0036 (sale prices) on a scratch database. Run after all migrations.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('d7d7d7d7-0000-0000-0000-00000000000a', 'sp-a@example.com', '{"full_name":"Amina Hassan"}')
on conflict do nothing;
insert into business_settings (business_name) select 'Nataka Holidays' where not exists (select 1 from business_settings);
update business_settings set shop_delivery_fee = 300, shop_gift_wrap_fee = 0;

do $$ begin
  insert into products (id, name, slug, price, compare_at_price, stock) values ('a7000000-0000-0000-0000-000000000001', 'On sale', 'sp-sale', 800, 1000, 10);
  insert into products (id, name, slug, price, stock) values ('a7000000-0000-0000-0000-000000000002', 'Normal', 'sp-normal', 500, 10);
  raise notice 'S01 ok: a product can carry a higher original price, or none';
end $$;

do $$ declare msgs int := 0; begin
  begin insert into products (name, slug, price, compare_at_price, stock) values ('Bad', 'sp-bad1', 800, 800, 1); exception when check_violation then msgs := msgs + 1; end;
  begin insert into products (name, slug, price, compare_at_price, stock) values ('Bad', 'sp-bad2', 800, 500, 1); exception when check_violation then msgs := msgs + 1; end;
  begin insert into products (name, slug, price, compare_at_price, stock) values ('Bad', 'sp-bad3', 800, 0, 1); exception when check_violation then msgs := msgs + 1; end;
  begin update products set price = 1200 where slug = 'sp-sale'; exception when check_violation then msgs := msgs + 1; end;
  assert msgs = 4, 'all four refused: ' || msgs;
  raise notice 'S02 ok: an original price that is not higher than the price is refused, including raising the price past it';
end $$;

do $$ declare o orders; begin
  perform set_config('request.jwt.claim.sub', 'd7d7d7d7-0000-0000-0000-00000000000a', false);
  execute 'set local role authenticated';
  o := create_order('[{"product_id":"a7000000-0000-0000-0000-000000000001","quantity":2}]'::jsonb, 'handover', 'Amina Hassan', '254712345678', 'Room 4', null);
  execute 'reset role';
  assert o.subtotal = 1600 and o.total = 1600, 'priced at the real price (800), not the original (1000)';
  assert (select unit_price from order_items where order_id = o.id) = 800;
  raise notice 'S03 ok: orders are charged the real price (KSh %), never the crossed-out one', o.subtotal;
end $$;

do $$ begin
  update products set compare_at_price = null where slug = 'sp-sale';
  assert (select compare_at_price from products where slug = 'sp-sale') is null;
  update products set price = 1200 where slug = 'sp-sale';
  raise notice 'S04 ok: ending a sale (clearing the original price) lets the price be changed freely';
end $$;

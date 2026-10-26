-- Checks migration 0031 (low-stock alerts) on a scratch database. Run after all migrations.
\set ON_ERROR_STOP on
insert into app_secrets (key, value) values ('mpesa_callback_secret', 'test-secret-123')
on conflict (key) do update set value = excluded.value;
insert into business_settings (business_name) select 'Nataka Holidays' where not exists (select 1 from business_settings);
update business_settings set shop_low_stock_threshold = 2;

insert into products (id, name, slug, price, stock, is_active) values
  ('a2000000-0000-0000-0000-000000000001', 'Plenty', 'ls-plenty', 100, 20, true),
  ('a2000000-0000-0000-0000-000000000002', 'Nearly out', 'ls-nearly', 100, 2, true),
  ('a2000000-0000-0000-0000-000000000003', 'Gone', 'ls-gone', 100, 0, true),
  ('a2000000-0000-0000-0000-000000000004', 'Hidden low', 'ls-hidden', 100, 1, false),
  ('a2000000-0000-0000-0000-000000000005', 'Kikoy', 'ls-kikoy', 100, 0, true);
insert into product_variants (product_id, name, stock) values
  ('a2000000-0000-0000-0000-000000000005', 'Blue', 1),
  ('a2000000-0000-0000-0000-000000000005', 'Red', 9);

do $$ declare r jsonb; names text; begin
  r := low_stock_items('test-secret-123');
  select string_agg(i->>'name' || coalesce(' / ' || (i->>'option'), '') || ' = ' || (i->>'stock'), '; ' order by (i->>'stock')::int, i->>'name')
    into names from jsonb_array_elements(r->'items') i;
  assert names = 'Gone = 0; Kikoy / Blue = 1; Nearly out = 2', names;
  raise notice 'L01 ok: low items are "%" (not Plenty, not the hidden product, not Kikoy/Red; Kikoy is listed by colour)', names;
end $$;

do $$ declare a jsonb; b jsonb; begin
  a := low_stock_items('test-secret-123');
  perform mark_low_stock_sent('test-secret-123', a->>'digest');
  b := low_stock_items('test-secret-123');
  assert b->>'digest' = b->>'last_digest', 'same list = already sent';
  update products set stock = 1 where slug = 'ls-nearly';
  b := low_stock_items('test-secret-123');
  assert b->>'digest' is distinct from b->>'last_digest', 'a change makes it new again';
  raise notice 'L02 ok: the same list is not sent twice, a change in stock makes a new e-mail due';
end $$;

do $$ declare r jsonb; begin
  update business_settings set shop_low_stock_threshold = 0;
  r := low_stock_items('test-secret-123');
  assert jsonb_array_length(r->'items') = 0 and r->>'digest' is null;
  update business_settings set shop_low_stock_threshold = 2;
  update products set stock = 20 where slug in ('ls-nearly', 'ls-gone');
  update product_variants set stock = 9 where name = 'Blue';
  r := low_stock_items('test-secret-123');
  assert jsonb_array_length(r->'items') = 0 and r->>'digest' is null, 'nothing low = nothing to send';
  raise notice 'L03 ok: threshold 0 switches alerts off, and nothing low means nothing to send';
end $$;

do $$ begin
  begin perform low_stock_items('wrong'); raise exception 'should have failed';
  exception when others then assert sqlerrm = 'invalid secret'; end;
  begin perform mark_low_stock_sent('wrong', 'x'); raise exception 'should have failed';
  exception when others then assert sqlerrm = 'invalid secret'; end;
  raise notice 'L04 ok: both functions refuse a wrong secret';
end $$;

set role authenticated;
do $$ begin
  begin
    update business_settings set shop_low_stock_threshold = 1;
  exception when others then null;
  end;
  assert (select shop_low_stock_threshold from business_settings) = 2, 'a guest cannot change the setting';
  raise notice 'L05 ok: only the owner can change the threshold';
end $$;
reset role;

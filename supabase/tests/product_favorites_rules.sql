-- Checks migration 0035 (shop wishlist) on a scratch database. Run after all migrations.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('d6d6d6d6-0000-0000-0000-00000000000a', 'pf-a@example.com', '{"full_name":"Amina Hassan"}'),
  ('d6d6d6d6-0000-0000-0000-00000000000b', 'pf-b@example.com', '{"full_name":"Joe Mwangi"}')
on conflict do nothing;
insert into products (id, name, slug, price, stock) values
  ('a6000000-0000-0000-0000-000000000001', 'Wish one', 'pf-one', 100, 5),
  ('a6000000-0000-0000-0000-000000000002', 'Wish two', 'pf-two', 100, 5);

set role authenticated;
select set_config('request.jwt.claim.sub', 'd6d6d6d6-0000-0000-0000-00000000000a', false);
do $$ begin
  insert into product_favorites (customer_id, product_id) values ('d6d6d6d6-0000-0000-0000-00000000000a', 'a6000000-0000-0000-0000-000000000001');
  insert into product_favorites (customer_id, product_id) values ('d6d6d6d6-0000-0000-0000-00000000000a', 'a6000000-0000-0000-0000-000000000002');
  assert (select count(*) from product_favorites) = 2;
  raise notice 'F01 ok: a guest can save products and sees their own list';
end $$;

do $$ begin
  begin insert into product_favorites (customer_id, product_id) values ('d6d6d6d6-0000-0000-0000-00000000000a', 'a6000000-0000-0000-0000-000000000001'); raise exception 'should fail';
  exception when unique_violation then null; end;
  raise notice 'F02 ok: saving the same product twice is refused (the app treats it as already saved)';
end $$;

select set_config('request.jwt.claim.sub', 'd6d6d6d6-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from product_favorites) = 0, 'B sees none of A''s';
  begin insert into product_favorites (customer_id, product_id) values ('d6d6d6d6-0000-0000-0000-00000000000a', 'a6000000-0000-0000-0000-000000000002'); raise exception 'should fail';
  exception when others then assert sqlerrm like '%row-level security%' or sqlerrm like '%duplicate%', sqlerrm; end;
  delete from product_favorites;
  reset role;
  assert (select count(*) from product_favorites) = 2, 'B could not delete A''s';
  raise notice 'F03 ok: another guest cannot see, add to or remove someone else''s list';
end $$;

set role anon;
do $$ begin
  assert (select count(*) from product_favorites) = 0;
  begin insert into product_favorites (customer_id, product_id) values ('d6d6d6d6-0000-0000-0000-00000000000a', 'a6000000-0000-0000-0000-000000000001'); raise exception 'should fail';
  exception when others then null; end;
  raise notice 'F04 ok: visitors who are not signed in see and save nothing';
end $$;
reset role;

do $$ declare n int; begin
  for n in 1..100 loop
    insert into products (name, slug, price, stock) values ('Fav ' || n, 'pf-fav-' || n, 100, 1);
  end loop;
  insert into product_favorites (customer_id, product_id)
  select 'd6d6d6d6-0000-0000-0000-00000000000b', id from products where slug like 'pf-fav-%' limit 100;
  begin insert into product_favorites (customer_id, product_id) values ('d6d6d6d6-0000-0000-0000-00000000000b', 'a6000000-0000-0000-0000-000000000001'); raise exception 'should fail';
  exception when others then assert sqlerrm like 'You can save up to 100%', sqlerrm; end;
  raise notice 'F05 ok: at most 100 saved items per guest';
end $$;

do $$ begin
  delete from products where id = 'a6000000-0000-0000-0000-000000000001';
  assert (select count(*) from product_favorites where product_id = 'a6000000-0000-0000-0000-000000000001') = 0;
  raise notice 'F06 ok: a removed product leaves everyone''s list';
end $$;

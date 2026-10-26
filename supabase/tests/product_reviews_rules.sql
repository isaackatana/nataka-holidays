-- Checks migration 0029 (shop product reviews) on a scratch database.
-- Run after all migrations and after shop_variants_rules.sql (it reuses the
-- sample shopper and products that script creates).
\set ON_ERROR_STOP on
\set U '''d0d0d0d0-0000-0000-0000-0000000000a1'''
\set OTHER '''d0d0d0d0-0000-0000-0000-0000000000a2'''
\set ADM '''d0d0d0d0-0000-0000-0000-0000000000ad'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:OTHER, 'other@example.com', '{"full_name":"Other Person"}'),
  (:ADM, 'owner@example.com', '{"full_name":"Owner"}')
on conflict do nothing;
update profiles set role = 'admin' where id = :ADM;

-- A completed order for the shopper containing the basket, a paid (not completed) one with the kikoy.
insert into orders (id, customer_id, customer_name, customer_phone, fulfilment, handover_note, subtotal, delivery_fee, total, status)
values
  ('e0000000-0000-0000-0000-000000000001', :U, 'Shopper', '254712345678', 'handover', 'Room 4', 800, 0, 800, 'completed'),
  ('e0000000-0000-0000-0000-000000000002', :U, 'Shopper', '254712345678', 'handover', 'Room 4', 1500, 0, 1500, 'paid');
insert into order_items (order_id, product_id, product_name, unit_price, quantity) values
  ('e0000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'Sisal basket', 800, 1),
  ('e0000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Kikoy cloth', 1500, 1);

-- A guest cannot review something from an order that is not completed
set role authenticated;
select set_config('request.jwt.claim.sub', 'd0d0d0d0-0000-0000-0000-0000000000a1', false);
do $$ begin
  begin
    insert into product_reviews (product_id, customer_id, order_id, rating)
    values ('b1000000-0000-0000-0000-000000000001', 'd0d0d0d0-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000002', 5);
    raise exception 'should have failed';
  exception when others then
    assert sqlerrm like 'You can only review a product%', sqlerrm;
  end;
  raise notice 'P01 ok: cannot review a product from an order that is not completed yet';
end $$;

-- ...or a product that was not in that order
do $$ begin
  begin
    insert into product_reviews (product_id, customer_id, order_id, rating)
    values ('b1000000-0000-0000-0000-000000000001', 'd0d0d0d0-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 5);
    raise exception 'should have failed';
  exception when others then
    assert sqlerrm like 'You can only review a product%', sqlerrm;
  end;
  raise notice 'P02 ok: cannot review a product that was not in the completed order';
end $$;

-- A valid review starts pending, with the name set by the database, and cannot self-approve or forge a reply
do $$ declare r product_reviews; begin
  insert into product_reviews (product_id, customer_id, order_id, rating, comment, status, owner_reply, reviewer_name)
  values ('b1000000-0000-0000-0000-000000000002', 'd0d0d0d0-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 5, 'Lovely', 'approved', 'Fake reply', 'Faker')
  returning * into r;
  assert r.status = 'pending', 'starts pending';
  assert r.owner_reply is null, 'reply stripped';
  assert r.reviewer_name is distinct from 'Faker', 'name from profile';
  raise notice 'P03 ok: a valid review starts pending; self-approval, forged reply and forged name are ignored (name "%")', r.reviewer_name;
end $$;

-- One review per guest per product
do $$ begin
  begin
    insert into product_reviews (product_id, customer_id, order_id, rating)
    values ('b1000000-0000-0000-0000-000000000002', 'd0d0d0d0-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 4);
    raise exception 'should have failed';
  exception when unique_violation then null;
  end;
  raise notice 'P04 ok: only one review per guest per product';
end $$;

-- Nobody else can write a review as the shopper
select set_config('request.jwt.claim.sub', 'd0d0d0d0-0000-0000-0000-0000000000a2', false);
do $$ begin
  begin
    insert into product_reviews (product_id, customer_id, order_id, rating)
    values ('b1000000-0000-0000-0000-000000000002', 'd0d0d0d0-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 1);
    raise exception 'should have failed';
  exception when others then
    assert sqlerrm like '%row-level security%' or sqlerrm like 'You can only review a product%', sqlerrm;
  end;
  raise notice 'P05 ok: a different guest cannot post a review in someone else''s name';
end $$;

-- The public sees nothing until approval; an edit sends it back
reset role;
set role anon;
do $$ begin
  assert (select count(*) from product_reviews) = 0, 'public sees no pending review';
  raise notice 'P06 ok: the public cannot see a pending review';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'd0d0d0d0-0000-0000-0000-0000000000ad', false);
update product_reviews set status = 'approved', owner_reply = 'Thank you!';
do $$ begin
  assert (select status from product_reviews) = 'approved' and (select owner_reply from product_reviews) = 'Thank you!';
  raise notice 'P07 ok: the owner can approve and reply';
end $$;

select set_config('request.jwt.claim.sub', 'd0d0d0d0-0000-0000-0000-0000000000a1', false);
update product_reviews set comment = 'Edited', owner_reply = 'Hacked', status = 'approved';
do $$ begin
  assert (select status from product_reviews) = 'pending', 'edit goes back to pending';
  assert (select owner_reply from product_reviews) = 'Thank you!', 'reply cannot be changed by guest';
  raise notice 'P08 ok: editing sends the review back to pending and the guest cannot touch the reply';
end $$;
reset role;

-- back to the SQL editor (no signed-in user), then approve
select set_config('request.jwt.claim.sub', '', false);
update product_reviews set status = 'approved';
set role anon;
do $$ declare s record; begin
  assert (select count(*) from product_reviews) = 1, 'public sees the approved review';
  select * into s from product_rating_stats();
  assert s.average = 5.0 and s.review_count = 1, 'stats';
  raise notice 'P09 ok: the public sees approved reviews and the rating summary (% from %)', s.average, s.review_count;
end $$;
reset role;

-- =========================================================
-- 0034_related_products.sql
-- "You might also like" on the shop cart page.
--   related_products(cart product ids): shop products to suggest, best first:
--     1. products that other guests bought in the same PAID orders as
--        something in the cart (most often first)
--     2. then products from the same category as the cart
--     3. then the newest products
--   Only products that are shown and in stock, and never ones already in the
--   cart. It returns product ids and a count only (nothing about any guest),
--   so it is safe for visitors to call.
-- Run once in the Supabase SQL editor, after 0033.
-- =========================================================

create or replace function related_products(p_product_ids uuid[], p_limit int default 4)
returns table (product_id uuid, together int)
language sql
security definer set search_path = public
stable
as $$
  with cart as (
    select distinct unnest(p_product_ids[1:20]) as id
  ),
  co as (
    select i2.product_id, count(distinct i2.order_id)::int as together
    from order_items i1
    join orders o on o.id = i1.order_id and o.status in ('paid', 'packed', 'completed')
    join order_items i2 on i2.order_id = i1.order_id and i2.product_id is not null
    where i1.product_id in (select id from cart)
      and i2.product_id not in (select id from cart)
    group by i2.product_id
  ),
  cats as (
    select distinct category from products where id in (select id from cart)
  )
  select p.id, coalesce(co.together, 0)
  from products p
  left join co on co.product_id = p.id
  where p.is_active and p.stock > 0 and p.id not in (select id from cart)
  order by coalesce(co.together, 0) desc,
           (p.category in (select category from cats)) desc,
           p.created_at desc,
           p.id
  limit least(greatest(coalesce(p_limit, 4), 1), 8);
$$;

revoke all on function related_products(uuid[], int) from public;
grant execute on function related_products(uuid[], int) to anon, authenticated;

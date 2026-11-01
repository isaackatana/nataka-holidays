-- =========================================================
-- 0035_product_favorites.sql
-- A wishlist for shop products: signed-in guests tap the heart on a product
-- and find it again on their Favorites page (next to their saved stays).
--   * each guest sees and changes only their own list
--   * at most 100 saved items per guest
--   * removing a product from the shop removes it from everyone's list
-- Run once in the Supabase SQL editor, after 0034.
-- =========================================================

create table product_favorites (
  customer_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);
create index idx_product_favorites_product on product_favorites (product_id);

create or replace function guard_product_favorites_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (select count(*) from product_favorites where customer_id = new.customer_id) >= 100 then
    raise exception 'You can save up to 100 shop items. Remove one to add another.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_product_favorites_limit
  before insert on product_favorites
  for each row execute function guard_product_favorites_limit();

alter table product_favorites enable row level security;

create policy "product_favorites_select_own" on product_favorites
  for select using (customer_id = auth.uid());
create policy "product_favorites_insert_own" on product_favorites
  for insert with check (customer_id = auth.uid());
create policy "product_favorites_delete_own" on product_favorites
  for delete using (customer_id = auth.uid());

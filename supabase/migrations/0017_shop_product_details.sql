-- =========================================================
-- 0017_shop_product_details.sql
-- Shop product detail pages: a category per product and a photo gallery.
--   products.category   what the shop filter groups by (admin types it)
--   product_images       any number of photos per product, in order
--   products.image_path  stays as the COVER photo (the first gallery photo);
--                        the admin screen keeps it in step, so the shop grid
--                        and the cart need no extra lookups.
-- Photos live in the existing public 'product-images' bucket.
-- Run this in the Supabase SQL editor (safe to run once).
-- =========================================================

alter table products
  add column category text not null default 'Other'
  check (char_length(category) between 2 and 40);

create index idx_products_category on products (category);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 1 and 300),
  sort_order int not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);
create index idx_product_images_product on product_images (product_id, sort_order);

alter table product_images enable row level security;

-- Photos of a product are public exactly when the product is.
create policy "product_images_select_active_or_admin" on product_images
  for select using (
    is_admin()
    or exists (select 1 from products p where p.id = product_images.product_id and p.is_active)
  );
create policy "product_images_insert_admin" on product_images
  for insert with check (is_admin());
create policy "product_images_update_admin" on product_images
  for update using (is_admin()) with check (is_admin());
create policy "product_images_delete_admin" on product_images
  for delete using (is_admin());

-- Products that already have a single photo keep it as photo number one.
insert into product_images (product_id, storage_path, sort_order)
select id, image_path, 0 from products where image_path is not null;

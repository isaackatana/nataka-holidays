-- =========================================================
-- 0036_product_sale_price.sql
-- "Sale" prices in the shop: set an ORIGINAL price on a product and the shop
-- shows it crossed out next to the real price, with a "Sale -20%" tag.
--   * products.price is still the one real price: it is what the cart,
--     checkout, discount codes and orders use, exactly as before
--   * products.compare_at_price is for display only, and must be higher than
--     the price (the database refuses anything else)
--   * to end a sale, clear the original price (or raise the price) in
--     Admin -> Products
-- Run once in the Supabase SQL editor, after 0035.
-- =========================================================

alter table products
  add column compare_at_price int
  check (compare_at_price is null or compare_at_price > 0);

alter table products
  add constraint products_compare_at_above_price
  check (compare_at_price is null or compare_at_price > price);

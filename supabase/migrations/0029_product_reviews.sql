-- =========================================================
-- 0029_product_reviews.sql
-- Guests can review a shop product they bought. Same idea and same
-- safeguards as stay and experience reviews, in their own table:
--   * only the guest whose order you marked COMPLETED, and that contained
--     the product, can review it
--   * one review per guest per product
--   * every new review, and every edit, starts as 'pending' until you approve it
--   * guests cannot write the business reply or choose the shown name
--   * the public sees only approved reviews
-- Run once in the Supabase SQL editor, after 0028.
-- =========================================================

create table product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  status review_status not null default 'pending',
  reviewer_name text,
  owner_reply text,
  owner_replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_reviews_comment_length check (comment is null or char_length(comment) <= 1000),
  constraint product_reviews_reply_length check (owner_reply is null or char_length(owner_reply) <= 1000),
  constraint uq_product_reviews_guest_product unique (customer_id, product_id)
);

create index idx_product_reviews_product on product_reviews (product_id, status);

create trigger trg_product_reviews_updated_at
  before update on product_reviews
  for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Rules a guest cannot get around
-- ---------------------------------------------------------
create or replace function guard_product_review_write()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then
    return new; -- dashboard / service role / admin moderation and replies
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.owner_reply := null;
    new.owner_replied_at := null;
    if new.order_id is null or not exists (
      select 1
      from orders o
      join order_items i on i.order_id = o.id
      where o.id = new.order_id
        and o.customer_id = auth.uid()
        and o.status = 'completed'
        and i.product_id = new.product_id
    ) then
      raise exception 'You can only review a product from an order you have received.' using errcode = '42501';
    end if;
  else
    new.product_id := old.product_id;
    new.customer_id := old.customer_id;
    new.order_id := old.order_id;
    new.owner_reply := old.owner_reply;
    new.owner_replied_at := old.owner_replied_at;
    if new.rating is distinct from old.rating or new.comment is distinct from old.comment then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_product_reviews_guard
  before insert or update on product_reviews
  for each row execute function guard_product_review_write();

-- The shown name ("Amina K.") is set from the guest's profile, never by the guest.
create or replace function set_product_review_name()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.reviewer_name := review_display_name(new.customer_id);
  else
    new.reviewer_name := old.reviewer_name;
  end if;
  return new;
end;
$$;

create trigger trg_product_reviews_name
  before insert or update on product_reviews
  for each row execute function set_product_review_name();

-- ---------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------
alter table product_reviews enable row level security;

create policy "product_reviews_select_approved_or_own_or_admin"
  on product_reviews for select
  using (status = 'approved' or customer_id = auth.uid() or is_admin());

create policy "product_reviews_insert_own"
  on product_reviews for insert
  with check (customer_id = auth.uid());

create policy "product_reviews_update_own_or_admin"
  on product_reviews for update
  using (customer_id = auth.uid() or is_admin())
  with check (customer_id = auth.uid() or is_admin());

create policy "product_reviews_delete_admin"
  on product_reviews for delete
  using (is_admin());

-- ---------------------------------------------------------
-- Average rating and count per product (approved reviews only), one call for all
-- ---------------------------------------------------------
create or replace function product_rating_stats()
returns table (product_id uuid, average numeric, review_count int)
language sql
security definer set search_path = public
stable
as $$
  select r.product_id,
         round(avg(r.rating)::numeric, 1) as average,
         count(*)::int as review_count
  from product_reviews r
  join products p on p.id = r.product_id and p.is_active
  where r.status = 'approved'
  group by r.product_id;
$$;

revoke all on function product_rating_stats() from public;
grant execute on function product_rating_stats() to anon, authenticated;

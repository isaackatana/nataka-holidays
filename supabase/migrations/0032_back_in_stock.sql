-- =========================================================
-- 0032_back_in_stock.sql
-- "Tell me when it's back": a signed-in guest can ask to be e-mailed when a
-- sold-out shop product (or a sold-out colour) is in stock again.
--   * only while the item really is sold out, and at most 20 waiting
--     requests per guest
--   * the daily job (the same one that sends reminders) e-mails each guest
--     once, listing everything of theirs that is back, then the requests are
--     removed
--   * guests only ever see or change their own requests; you (admin) can
--     see how many are waiting for each item
--   * the two server functions need the same server secret as the other
--     e-mail functions
-- Run once in the Supabase SQL editor, after 0031.
-- =========================================================

create table back_in_stock_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One request per guest per item (a colour counts as its own item).
create unique index uq_back_in_stock_item
  on back_in_stock_requests (customer_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index idx_back_in_stock_product on back_in_stock_requests (product_id);

create or replace function guard_back_in_stock_request()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  prod products;
  opt product_variants;
  has_options boolean;
begin
  select * into prod from products where id = new.product_id;
  if prod.id is null or not prod.is_active then
    raise exception 'That product is not available.' using errcode = 'P0001';
  end if;

  select exists (select 1 from product_variants where product_id = prod.id) into has_options;
  if has_options then
    if new.variant_id is null then
      raise exception 'Choose a colour first.' using errcode = 'P0001';
    end if;
    select * into opt from product_variants where id = new.variant_id and product_id = prod.id;
    if opt.id is null then
      raise exception 'That colour is not available.' using errcode = 'P0001';
    end if;
    if opt.stock > 0 then
      raise exception 'That colour is in stock right now.' using errcode = 'P0001';
    end if;
  else
    if new.variant_id is not null then
      raise exception 'That colour is not available.' using errcode = 'P0001';
    end if;
    if prod.stock > 0 then
      raise exception 'That product is in stock right now.' using errcode = 'P0001';
    end if;
  end if;

  if (select count(*) from back_in_stock_requests where customer_id = new.customer_id) >= 20 then
    raise exception 'You are already waiting for 20 items. Remove one to add another.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_back_in_stock_guard
  before insert on back_in_stock_requests
  for each row execute function guard_back_in_stock_request();

alter table back_in_stock_requests enable row level security;

create policy "back_in_stock_select_own_or_admin" on back_in_stock_requests
  for select using (customer_id = auth.uid() or is_admin());
create policy "back_in_stock_insert_own" on back_in_stock_requests
  for insert with check (customer_id = auth.uid());
create policy "back_in_stock_delete_own_or_admin" on back_in_stock_requests
  for delete using (customer_id = auth.uid() or is_admin());

-- ---------------------------------------------------------
-- For the daily job: guests whose waiting items are in stock again.
-- ---------------------------------------------------------
create or replace function back_in_stock_due(p_secret text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
  result jsonb;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid secret' using errcode = '42501';
  end if;

  with due as (
    select r.id as request_id, r.customer_id, r.created_at, p.name, p.slug, v.name as option,
           coalesce(v.stock, p.stock) as stock
    from back_in_stock_requests r
    join products p on p.id = r.product_id and p.is_active
    left join product_variants v on v.id = r.variant_id
    where coalesce(v.stock, p.stock) > 0
    order by r.created_at
    limit 200
  )
  select jsonb_build_object(
    'business', (select jsonb_build_object('name', s.business_name, 'phone', s.contact_phone, 'email', s.contact_email) from business_settings s limit 1),
    'guests', coalesce(jsonb_agg(g.guest), '[]'::jsonb)
  ) into result
  from (
    select jsonb_build_object(
      'customer_id', d.customer_id,
      'email', (select u.email from auth.users u where u.id = d.customer_id),
      'name', (select pr.full_name from profiles pr where pr.id = d.customer_id),
      'items', jsonb_agg(jsonb_build_object('request_id', d.request_id, 'name', d.name, 'option', d.option, 'slug', d.slug, 'stock', d.stock) order by d.created_at)
    ) as guest
    from due d
    group by d.customer_id
  ) g;

  return result;
end;
$$;
revoke all on function back_in_stock_due(text) from public;
grant execute on function back_in_stock_due(text) to anon, authenticated;

-- The e-mail went out: those requests are done and are removed.
create or replace function mark_back_in_stock_notified(p_secret text, p_ids uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid secret' using errcode = '42501';
  end if;
  delete from back_in_stock_requests where id = any(p_ids);
end;
$$;
revoke all on function mark_back_in_stock_notified(text, uuid[]) from public;
grant execute on function mark_back_in_stock_notified(text, uuid[]) to anon, authenticated;

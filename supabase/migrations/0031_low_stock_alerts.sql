-- =========================================================
-- 0031_low_stock_alerts.sql
-- A daily e-mail to you when shop products (or colours) are running low.
--   * Settings -> "Low-stock alert at": an item is "low" when this many or
--     fewer are left (default 2; set 0 to switch the e-mails off)
--   * low_stock_items: what the daily job asks for (needs the same server
--     secret as the other e-mail functions). Products with colours are
--     listed colour by colour.
--   * mark_low_stock_sent: remembers what was last e-mailed, so you only get
--     a new e-mail when the list of low items (or their counts) CHANGES,
--     not the same reminder every morning.
-- Run once in the Supabase SQL editor, after 0030, BEFORE deploying.
-- =========================================================

alter table business_settings
  add column shop_low_stock_threshold int not null default 2
  check (shop_low_stock_threshold between 0 and 100);

create table shop_low_stock_digest (
  id boolean primary key default true check (id),
  last_digest text,
  sent_at timestamptz
);
insert into shop_low_stock_digest (id) values (true);
alter table shop_low_stock_digest enable row level security; -- no policies: only the functions below touch it

create or replace function low_stock_items(p_secret text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
  threshold int;
  items jsonb;
  digest text;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid secret' using errcode = '42501';
  end if;

  select coalesce(shop_low_stock_threshold, 2) into threshold from business_settings limit 1;
  threshold := coalesce(threshold, 2);

  if threshold = 0 then
    return jsonb_build_object('threshold', 0, 'items', '[]'::jsonb, 'digest', null, 'last_digest', null, 'business', null);
  end if;

  with low as (
    select p.id::text as key, p.name, null::text as option, p.stock
    from products p
    where p.is_active
      and p.stock <= threshold
      and not exists (select 1 from product_variants v where v.product_id = p.id)
    union all
    select v.id::text, p.name, v.name, v.stock
    from product_variants v
    join products p on p.id = v.product_id
    where p.is_active and v.stock <= threshold
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'option', option, 'stock', stock) order by stock, name, option), '[]'::jsonb),
         md5(coalesce(string_agg(key || ':' || stock::text, ',' order by key), ''))
  into items, digest
  from low;

  return jsonb_build_object(
    'threshold', threshold,
    'items', items,
    'digest', case when jsonb_array_length(items) = 0 then null else digest end,
    'last_digest', (select last_digest from shop_low_stock_digest where id),
    'business', (select jsonb_build_object('name', s.business_name, 'phone', s.contact_phone, 'email', s.contact_email) from business_settings s limit 1)
  );
end;
$$;
revoke all on function low_stock_items(text) from public;
grant execute on function low_stock_items(text) to anon, authenticated;

create or replace function mark_low_stock_sent(p_secret text, p_digest text)
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
  update shop_low_stock_digest set last_digest = p_digest, sent_at = now() where id;
end;
$$;
revoke all on function mark_low_stock_sent(text, text) from public;
grant execute on function mark_low_stock_sent(text, text) to anon, authenticated;

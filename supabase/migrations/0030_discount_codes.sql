-- =========================================================
-- 0030_discount_codes.sql
-- Discount codes for the shop.
--   * you create codes in Admin -> Discounts: a percentage or a fixed KSh
--     amount off the ITEMS (not delivery), with an optional minimum spend,
--     expiry date, total-uses limit and "once per guest" rule
--   * guests type a code at checkout; the database checks it and works out
--     the discount, so it cannot be faked, and the real total is the
--     database's own
--   * the discount can never make an order free (at least KSh 1 is left)
--   * a use is counted when the order is placed and given back if the order
--     expires or is cancelled
--   * guessing codes at the checkout box is throttled
-- Run once in the Supabase SQL editor, after 0029.
-- =========================================================

create table discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  kind text not null check (kind in ('percent', 'amount')),
  value int not null check (value >= 1),
  min_subtotal int not null default 0 check (min_subtotal >= 0),
  max_uses int check (max_uses is null or max_uses >= 1),
  uses int not null default 0 check (uses >= 0),
  once_per_guest boolean not null default true,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint discount_codes_percent_range check (kind <> 'percent' or value between 1 and 100)
);

alter table discount_codes enable row level security;

create policy "discount_codes_admin_all" on discount_codes
  for all using (is_admin()) with check (is_admin());

alter table orders
  add column discount_code text,
  add column discount_amount int not null default 0 check (discount_amount >= 0);

-- Failed code tries, to slow down guessing. Nobody reads this directly.
create table discount_code_attempts (
  customer_id uuid not null,
  created_at timestamptz not null default now()
);
create index idx_discount_code_attempts on discount_code_attempts (customer_id, created_at);
alter table discount_code_attempts enable row level security;

-- ---------------------------------------------------------
-- The one place a code is judged (internal). With p_reserve it also
-- counts the use, locking the code so two orders cannot both take the last one.
-- ---------------------------------------------------------
create or replace function apply_discount_code(p_code text, p_subtotal int, p_customer uuid, p_reserve boolean)
returns table (code text, amount int)
language plpgsql
security definer set search_path = public
as $$
declare
  norm text := upper(trim(coalesce(p_code, '')));
  dc discount_codes;
  raw int;
begin
  if (select count(*) from discount_code_attempts a
      where a.customer_id = p_customer and a.created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Too many tries. Please wait a few minutes.' using errcode = 'P0001';
  end if;

  if p_reserve then
    select * into dc from discount_codes d where d.code = norm for update;
  else
    select * into dc from discount_codes d where d.code = norm;
  end if;

  if dc.id is null or not dc.is_active or (dc.expires_at is not null and dc.expires_at <= now()) then
    raise exception 'That code is not valid or has expired.' using errcode = 'P0001';
  end if;
  if dc.max_uses is not null and dc.uses >= dc.max_uses then
    raise exception 'That code has been fully used.' using errcode = 'P0001';
  end if;
  if p_subtotal < dc.min_subtotal then
    raise exception 'This code needs at least KSh % of items.', dc.min_subtotal using errcode = 'P0001';
  end if;
  if dc.once_per_guest and exists (
    select 1 from orders o
    where o.customer_id = p_customer and o.discount_code = dc.code
      and o.status not in ('cancelled', 'expired')
  ) then
    raise exception 'You have already used this code.' using errcode = 'P0001';
  end if;

  raw := case dc.kind when 'percent' then (p_subtotal * dc.value) / 100 else dc.value end;
  -- Never take the whole price: at least KSh 1 is always left to pay.
  amount := greatest(least(raw, p_subtotal - 1), 0);
  code := dc.code;

  if p_reserve then
    update discount_codes set uses = uses + 1 where id = dc.id;
  end if;
  return next;
end;
$$;
revoke all on function apply_discount_code(text, int, uuid, boolean) from public, anon, authenticated;

-- What the checkout box calls: tells the guest the discount without placing anything.
create or replace function check_discount_code(p_code text, p_subtotal int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r record;
begin
  if uid is null then
    raise exception 'Please sign in to use a code.' using errcode = '42501';
  end if;
  begin
    select * into r from apply_discount_code(p_code, p_subtotal, uid, false);
    return jsonb_build_object('ok', true, 'code', r.code, 'amount', r.amount);
  exception when sqlstate 'P0001' then
    -- Recorded here, outside the block that failed, so it is kept.
    delete from discount_code_attempts where created_at < now() - interval '1 day';
    insert into discount_code_attempts (customer_id) values (uid);
    return jsonb_build_object('ok', false, 'message', sqlerrm);
  end;
end;
$$;
revoke all on function check_discount_code(text, int) from public, anon;
grant execute on function check_discount_code(text, int) to authenticated;

-- ---------------------------------------------------------
-- Stock helpers now also give back / retake the code's use.
-- ---------------------------------------------------------
create or replace function restock_order_items(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- The order's discount code use is given back too.
  update discount_codes d
  set uses = greatest(d.uses - 1, 0)
  from orders o
  where o.id = p_order_id and o.discount_code is not null and d.code = o.discount_code;

  update product_variants v
  set stock = v.stock + i.quantity
  from order_items i
  where i.order_id = p_order_id and i.variant_id = v.id;

  update products p
  set stock = p.stock + i.quantity
  from order_items i
  where i.order_id = p_order_id and i.product_id = p.id and i.variant_id is null;
end;
$$;

revoke all on function restock_order_items(uuid) from public, anon, authenticated;

create or replace function take_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update discount_codes d
  set uses = d.uses + 1
  from orders o
  where o.id = p_order_id and o.discount_code is not null and d.code = o.discount_code;

  update product_variants v
  set stock = greatest(v.stock - i.quantity, 0)
  from order_items i
  where i.order_id = p_order_id and i.variant_id = v.id;

  update products p
  set stock = greatest(p.stock - i.quantity, 0)
  from order_items i
  where i.order_id = p_order_id and i.product_id = p.id and i.variant_id is null;
end;
$$;

revoke all on function take_order_stock(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------
-- create_order takes an optional discount code (a seventh argument).
-- ---------------------------------------------------------
drop function create_order(jsonb, text, text, text, text, text);

create or replace function create_order(
  p_items jsonb,
  p_fulfilment text,
  p_name text,
  p_phone text,
  p_handover_note text,
  p_address text,
  p_discount_code text default null
)
returns orders
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  line record;
  prod products;
  opt product_variants;
  has_options boolean;
  new_order orders;
  sub int := 0;
  fee int := 0;
  disc record;
  disc_amount int := 0;
  disc_code text := null;
begin
  if uid is null then
    raise exception 'Please sign in to place an order.' using errcode = '42501';
  end if;

  if p_fulfilment not in ('handover', 'delivery') then
    raise exception 'Choose hand-over or delivery.' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Enter your name.' using errcode = 'P0001';
  end if;
  if p_phone is null or p_phone !~ '^254[17][0-9]{8}$' then
    raise exception 'Enter a valid Safaricom number.' using errcode = 'P0001';
  end if;
  if p_fulfilment = 'delivery' and char_length(trim(coalesce(p_address, ''))) < 5 then
    raise exception 'Enter a delivery address.' using errcode = 'P0001';
  end if;
  if p_fulfilment = 'handover' and char_length(trim(coalesce(p_handover_note, ''))) < 2 then
    raise exception 'Tell us where you are staying so we can hand it over.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;

  perform expire_stale_orders();

  if (select count(*) from orders where customer_id = uid and status = 'pending_payment') >= 3 then
    raise exception 'You have unpaid orders waiting. Pay for them or wait 30 minutes.' using errcode = 'P0001';
  end if;

  if p_fulfilment = 'delivery' then
    select coalesce(shop_delivery_fee, 0) into fee from business_settings limit 1;
  end if;

  insert into orders (customer_id, customer_name, customer_phone, customer_email, fulfilment,
                      handover_note, delivery_address, subtotal, delivery_fee, total)
  values (uid, trim(p_name), p_phone,
          (select email from auth.users where id = uid),
          p_fulfilment,
          nullif(trim(coalesce(p_handover_note, '')), ''),
          nullif(trim(coalesce(p_address, '')), ''),
          0, 0, 1)   -- placeholders; set below once the lines are priced
  returning * into new_order;

  -- The same product + option listed twice is added up. Locked in a fixed
  -- order so two simultaneous orders can never deadlock or oversell.
  for line in
    select (e->>'product_id')::uuid as product_id,
           nullif(e->>'variant_id', '')::uuid as variant_id,
           sum((e->>'quantity')::int) as quantity
    from jsonb_array_elements(p_items) e
    group by 1, 2
    order by 1, 2 nulls first
  loop
    if line.quantity < 1 or line.quantity > 20 then
      raise exception 'Quantity must be between 1 and 20.' using errcode = 'P0001';
    end if;

    select * into prod from products where id = line.product_id for update;
    if prod.id is null or not prod.is_active then
      raise exception 'An item in your cart is no longer available.' using errcode = 'P0001';
    end if;

    select exists (select 1 from product_variants where product_id = prod.id) into has_options;

    if has_options then
      if line.variant_id is null then
        raise exception 'Choose an option for %.', prod.name using errcode = 'P0001';
      end if;
      select * into opt from product_variants where id = line.variant_id and product_id = prod.id for update;
      if opt.id is null then
        raise exception 'An option in your cart is no longer available.' using errcode = 'P0001';
      end if;
      if opt.stock < line.quantity then
        raise exception 'Only % left of % (%).', opt.stock, prod.name, opt.name using errcode = 'P0001';
      end if;

      update product_variants set stock = stock - line.quantity where id = opt.id;
      insert into order_items (order_id, product_id, variant_id, variant_name, product_name, unit_price, quantity)
      values (new_order.id, prod.id, opt.id, opt.name, prod.name || ' (' || opt.name || ')', prod.price, line.quantity);
    else
      if line.variant_id is not null then
        raise exception 'An option in your cart is no longer available.' using errcode = 'P0001';
      end if;
      if prod.stock < line.quantity then
        raise exception 'Only % left of %.', prod.stock, prod.name using errcode = 'P0001';
      end if;

      update products set stock = stock - line.quantity where id = prod.id;
      insert into order_items (order_id, product_id, product_name, unit_price, quantity)
      values (new_order.id, prod.id, prod.name, prod.price, line.quantity);
    end if;

    sub := sub + prod.price * line.quantity;
  end loop;

  -- An optional discount code, checked and counted here so it cannot be faked.
  if nullif(trim(coalesce(p_discount_code, '')), '') is not null then
    select * into disc from apply_discount_code(p_discount_code, sub, uid, true);
    disc_amount := disc.amount;
    disc_code := disc.code;
  end if;

  update orders
  set subtotal = sub, delivery_fee = fee, total = sub - disc_amount + fee,
      discount_code = disc_code, discount_amount = disc_amount
  where id = new_order.id
  returning * into new_order;

  return new_order;
end;
$$;
revoke all on function create_order(jsonb, text, text, text, text, text, text) from public, anon;
grant execute on function create_order(jsonb, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------
-- The order e-mail data now includes the discount.
-- ---------------------------------------------------------
create or replace function order_notification_context(p_secret text, p_order_id uuid)
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

  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id, 'customer_name', o.customer_name, 'customer_email', o.customer_email,
      'customer_phone', o.customer_phone, 'fulfilment', o.fulfilment,
      'handover_note', o.handover_note, 'delivery_address', o.delivery_address,
      'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'total', o.total,
      'discount_code', o.discount_code, 'discount_amount', o.discount_amount,
      'status', o.status, 'created_at', o.created_at
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.product_name, 'unit_price', i.unit_price, 'quantity', i.quantity
      ) order by i.product_name)
      from order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'business', (
      select jsonb_build_object('name', s.business_name, 'phone', s.contact_phone, 'email', s.contact_email)
      from business_settings s limit 1
    )
  )
  into result
  from orders o where o.id = p_order_id;

  return result;
end;
$$;
revoke all on function order_notification_context(text, uuid) from public;
grant execute on function order_notification_context(text, uuid) to anon, authenticated;

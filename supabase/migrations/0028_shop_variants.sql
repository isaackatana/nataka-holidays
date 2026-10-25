-- =========================================================
-- 0028_shop_variants.sql
-- Colour / option choices for shop products (e.g. kikoy in Blue, Red).
--   product_variants  one row per option, each with its OWN stock
--   order_items       remembers which option was bought
--
-- How it fits together:
--   * A product with options sells ONLY by option. Its own stock number is
--     kept equal to the total of its options (a trigger does this), so the
--     shop grid, "sold out" and the admin list keep working unchanged.
--   * A product with no options works exactly as before.
--   * The name copied onto the order includes the option, e.g.
--     "Kikoy cloth (Blue)", so emails, My orders and Admin -> Orders show
--     it without any other change.
--   * Same safety rules as before: prices and stock are checked and
--     reserved by the database; stock goes back if an order expires or is
--     cancelled.
-- Run once in the Supabase SQL editor, after 0017.
-- =========================================================

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  stock int not null default 0 check (stock >= 0),
  sort_order int not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, name)
);
create index idx_product_variants_product on product_variants (product_id, sort_order);

alter table product_variants enable row level security;

create policy "product_variants_select_active_or_admin" on product_variants
  for select using (
    is_admin()
    or exists (select 1 from products p where p.id = product_variants.product_id and p.is_active)
  );
create policy "product_variants_insert_admin" on product_variants
  for insert with check (is_admin());
create policy "product_variants_update_admin" on product_variants
  for update using (is_admin()) with check (is_admin());
create policy "product_variants_delete_admin" on product_variants
  for delete using (is_admin());

alter table order_items
  add column variant_id uuid references product_variants(id) on delete set null,
  add column variant_name text;

-- Product stock = total of its options (only while it has options).
create or replace function sync_product_stock_from_variants()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  if exists (select 1 from product_variants where product_id = pid) then
    update products
    set stock = (select coalesce(sum(stock), 0) from product_variants where product_id = pid)
    where id = pid;
  end if;
  return null;
end;
$$;
revoke all on function sync_product_stock_from_variants() from public, anon, authenticated;

create trigger trg_product_variants_sync_stock
  after insert or update or delete on product_variants
  for each row execute function sync_product_stock_from_variants();

-- ---------------------------------------------------------
-- Stock helpers (internal). An order line with an option puts stock back
-- on / takes it from the option; a line without one uses the product.
-- ---------------------------------------------------------
create or replace function restock_order_items(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
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
-- The four functions that moved stock now use the helpers above.
-- (Everything else in them is unchanged from 0016.)
-- ---------------------------------------------------------
create or replace function expire_stale_orders()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  o record;
begin
  for o in
    select id from orders
    where status = 'pending_payment' and expires_at < now()
    for update skip locked
  loop
    perform restock_order_items(o.id);

    update orders set status = 'expired' where id = o.id;
  end loop;
end;
$$;
revoke all on function expire_stale_orders() from public, anon, authenticated;

create or replace function record_order_payment_result(
  p_secret text,
  p_checkout_request_id text,
  p_result_code int,
  p_result_desc text,
  p_receipt text,
  p_paid_amount int
)
returns order_payments
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
  result order_payments;
  o orders;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid callback secret' using errcode = '42501';
  end if;

  update order_payments
  set status = case when p_result_code = 0 then 'success' else 'failed' end,
      mpesa_receipt = p_receipt,
      result_desc = p_result_desc,
      paid_amount = p_paid_amount
  where checkout_request_id = p_checkout_request_id and status = 'pending'
  returning * into result;

  if result.id is null or p_result_code <> 0 then
    return result; -- unknown / already resolved (id is null), or a failure
  end if;

  select * into o from orders where id = result.order_id for update;

  if o.status in ('pending_payment', 'expired') then
    if coalesce(p_paid_amount, result.amount) < o.total then
      update orders set admin_note = 'Underpaid: expected ' || o.total || ', received ' || coalesce(p_paid_amount, 0) || '. Check M-Pesa.'
      where id = o.id;
    else
      if o.status = 'expired' then
        -- The stock was released when it expired; take it back (never below 0).
        perform take_order_stock(o.id);
        update orders set admin_note = 'Paid after the order expired. Check stock before packing.'
        where id = o.id;
      end if;
      update orders set status = 'paid', paid_at = now() where id = o.id;
    end if;
  else
    -- Money arrived for an order that is cancelled, or already paid.
    update orders
    set admin_note = case when o.status = 'cancelled'
          then 'Payment received after the order was cancelled. Refund via M-Pesa.'
          else 'Another payment arrived for an order already ' || o.status || '. Refund one via M-Pesa.' end
    where id = o.id;
  end if;

  return result;
end;
$$;
revoke all on function record_order_payment_result(text, text, int, text, text, int) from public;
grant execute on function record_order_payment_result(text, text, int, text, text, int) to anon, authenticated;

create or replace function admin_set_order_status(p_order_id uuid, p_status text, p_note text default null)
returns orders
language plpgsql
security definer set search_path = public
as $$
declare
  o orders;
begin
  if not is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  select * into o from orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'order not found' using errcode = 'P0001';
  end if;

  if not (
    (o.status = 'paid' and p_status in ('packed', 'completed', 'cancelled'))
    or (o.status = 'packed' and p_status in ('completed', 'cancelled'))
    or (o.status = 'pending_payment' and p_status = 'cancelled')
  ) then
    raise exception 'Cannot change an order from % to %.', o.status, p_status using errcode = 'P0001';
  end if;

  if p_status = 'cancelled' then
    perform restock_order_items(o.id);
  end if;

  update orders
  set status = p_status,
      admin_note = coalesce(nullif(trim(p_note), ''), admin_note)
  where id = o.id
  returning * into o;
  return o;
end;
$$;
revoke all on function admin_set_order_status(uuid, text, text) from public, anon;
grant execute on function admin_set_order_status(uuid, text, text) to authenticated;

create or replace function cancel_order(p_order_id uuid)
returns orders
language plpgsql
security definer set search_path = public
as $$
declare
  o orders;
begin
  select * into o from orders where id = p_order_id for update;
  if o.id is null or (o.customer_id is distinct from auth.uid() and not is_admin()) then
    raise exception 'order not found' using errcode = 'P0001';
  end if;

  if o.status = 'cancelled' then
    return o;
  end if;
  if o.status <> 'pending_payment' then
    raise exception 'This order can no longer be cancelled here. Contact us.' using errcode = 'P0001';
  end if;

  perform restock_order_items(o.id);

  update orders set status = 'cancelled' where id = o.id returning * into o;
  return o;
end;
$$;
revoke all on function cancel_order(uuid) from public, anon;
grant execute on function cancel_order(uuid) to authenticated;

-- ---------------------------------------------------------
-- create_order, now option-aware.
--   p_items: [{ "product_id": "<uuid>", "variant_id": "<uuid or null>", "quantity": 2 }, ...]
-- ---------------------------------------------------------
create or replace function create_order(
  p_items jsonb,
  p_fulfilment text,
  p_name text,
  p_phone text,
  p_handover_note text,
  p_address text
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

  update orders set subtotal = sub, delivery_fee = fee, total = sub + fee
  where id = new_order.id
  returning * into new_order;

  return new_order;
end;
$$;
revoke all on function create_order(jsonb, text, text, text, text, text) from public, anon;
grant execute on function create_order(jsonb, text, text, text, text, text) to authenticated;

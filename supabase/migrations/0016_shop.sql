-- =========================================================
-- 0016_shop.sql
-- Souvenir / local-products shop.
--   products        what is for sale (admin-managed, public read of active ones)
--   orders          one per checkout; created ONLY by create_order()
--   order_items     what was in each order (name + price are copied, so
--                   later product edits never change a past order)
--   order_payments  M-Pesa attempts for an order (own table: the booking
--                   payments table and its functions are left untouched)
--
-- Safety rules, all enforced here in the database, not the browser:
--   * prices and the total are computed from the products table
--   * stock is reserved when the order is created and given back if the
--     order expires (30 min unpaid) or is cancelled
--   * nobody can write orders/payments directly; only the functions below
-- =========================================================

alter table business_settings
  add column shop_delivery_fee int not null default 300
  check (shop_delivery_fee >= 0 and shop_delivery_fee <= 10000);

-- ---------------------------------------------------------
-- products
-- ---------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$' and char_length(slug) <= 120),
  description text not null default '' check (char_length(description) <= 2000),
  price int not null check (price between 1 and 250000),
  stock int not null default 0 check (stock >= 0),
  image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_products_updated_at
  before update on products
  for each row execute function set_updated_at();

alter table products enable row level security;

create policy "products_select_active_or_admin" on products
  for select using (is_active or is_admin());
create policy "products_insert_admin" on products
  for insert with check (is_admin());
create policy "products_update_admin" on products
  for update using (is_admin()) with check (is_admin());
create policy "products_delete_admin" on products
  for delete using (is_admin());

-- ---------------------------------------------------------
-- orders, order_items, order_payments
-- ---------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles(id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_phone text not null check (customer_phone ~ '^254[17][0-9]{8}$'),
  customer_email text,
  fulfilment text not null check (fulfilment in ('handover', 'delivery')),
  handover_note text check (char_length(handover_note) <= 300),
  delivery_address text check (char_length(delivery_address) <= 500),
  subtotal int not null check (subtotal >= 0),
  delivery_fee int not null default 0 check (delivery_fee >= 0),
  total int not null check (total >= 1),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'packed', 'completed', 'cancelled', 'expired')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  paid_at timestamptz,
  admin_note text check (char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_fulfilment_details check (
    (fulfilment = 'delivery' and char_length(coalesce(delivery_address, '')) >= 5)
    or (fulfilment = 'handover' and char_length(coalesce(handover_note, '')) >= 2)
  )
);
create index idx_orders_customer on orders (customer_id, created_at desc);
create index idx_orders_status on orders (status, created_at desc);

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  unit_price int not null check (unit_price >= 1),
  quantity int not null check (quantity between 1 and 20)
);
create index idx_order_items_order on order_items (order_id);

create table order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  amount int not null check (amount >= 1),
  phone text not null,
  checkout_request_id text not null unique,
  merchant_request_id text,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  mpesa_receipt text,
  result_desc text,
  paid_amount int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_order_payments_order on order_payments (order_id);

create trigger trg_order_payments_updated_at
  before update on order_payments
  for each row execute function set_updated_at();

alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_payments enable row level security;

-- Read-only for the owner and admins. There are NO insert/update/delete
-- policies: every change goes through the functions below.
create policy "orders_select_own_or_admin" on orders
  for select using (customer_id = auth.uid() or is_admin());
create policy "order_items_select_own_or_admin" on order_items
  for select using (exists (
    select 1 from orders o where o.id = order_items.order_id
      and (o.customer_id = auth.uid() or is_admin())));
create policy "order_payments_select_own_or_admin" on order_payments
  for select using (exists (
    select 1 from orders o where o.id = order_payments.order_id
      and (o.customer_id = auth.uid() or is_admin())));

-- ---------------------------------------------------------
-- Stock is handed back for orders left unpaid past their expiry.
-- Internal: called by create_order and the admin functions.
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
    update products p
    set stock = p.stock + i.quantity
    from order_items i
    where i.order_id = o.id and i.product_id = p.id;

    update orders set status = 'expired' where id = o.id;
  end loop;
end;
$$;
revoke all on function expire_stale_orders() from public, anon, authenticated;

-- ---------------------------------------------------------
-- create_order: the only way an order comes into existence.
--   p_items: [{ "product_id": "<uuid>", "quantity": 2 }, ...]
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

  -- Stops one account tying up the stock with unpaid orders.
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

  -- Same product listed twice is added up. Locked in id order so two
  -- simultaneous orders can never deadlock or oversell.
  for line in
    select (e->>'product_id')::uuid as product_id, sum((e->>'quantity')::int) as quantity
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if line.quantity < 1 or line.quantity > 20 then
      raise exception 'Quantity must be between 1 and 20.' using errcode = 'P0001';
    end if;

    select * into prod from products where id = line.product_id for update;
    if prod.id is null or not prod.is_active then
      raise exception 'An item in your cart is no longer available.' using errcode = 'P0001';
    end if;
    if prod.stock < line.quantity then
      raise exception 'Only % left of %.', prod.stock, prod.name using errcode = 'P0001';
    end if;

    update products set stock = stock - line.quantity where id = prod.id;
    insert into order_items (order_id, product_id, product_name, unit_price, quantity)
    values (new_order.id, prod.id, prod.name, prod.price, line.quantity);
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

-- ---------------------------------------------------------
-- M-Pesa: record the prompt, then the result.
-- Guarded by the same secret as the booking payment functions.
-- ---------------------------------------------------------
create or replace function record_order_payment_request(
  p_secret text,
  p_order_id uuid,
  p_phone text,
  p_checkout_request_id text,
  p_merchant_request_id text
)
returns order_payments
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
  o orders;
  result order_payments;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid secret' using errcode = '42501';
  end if;

  select * into o from orders where id = p_order_id;
  if o.id is null or o.customer_id is distinct from auth.uid() then
    raise exception 'not your order' using errcode = '42501';
  end if;
  if o.status <> 'pending_payment' then
    raise exception 'This order can no longer be paid.' using errcode = 'P0001';
  end if;

  -- The amount is ALWAYS the order total; a caller cannot choose it.
  insert into order_payments (order_id, amount, phone, checkout_request_id, merchant_request_id)
  values (o.id, o.total, p_phone, p_checkout_request_id, p_merchant_request_id)
  returning * into result;
  return result;
end;
$$;
revoke all on function record_order_payment_request(text, uuid, text, text, text) from public, anon;
grant execute on function record_order_payment_request(text, uuid, text, text, text) to authenticated;

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
        update products p
        set stock = greatest(p.stock - i.quantity, 0)
        from order_items i
        where i.order_id = o.id and i.product_id = p.id;
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

-- ---------------------------------------------------------
-- Admin: move an order along. Cancelling gives the stock back.
--   paid -> packed -> completed;  pending/paid/packed -> cancelled
-- (Refunding a paid order is done on the M-Pesa side by the admin.)
-- ---------------------------------------------------------
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
    update products p
    set stock = p.stock + i.quantity
    from order_items i
    where i.order_id = o.id and i.product_id = p.id;
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

-- ---------------------------------------------------------
-- A guest cancels their own order before paying (admins may too).
-- Gives the stock back. Safe to repeat: a second call changes nothing.
-- ---------------------------------------------------------
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

  update products p
  set stock = p.stock + i.quantity
  from order_items i
  where i.order_id = o.id and i.product_id = p.id;

  update orders set status = 'cancelled' where id = o.id returning * into o;
  return o;
end;
$$;
revoke all on function cancel_order(uuid) from public, anon;
grant execute on function cancel_order(uuid) to authenticated;

-- ---------------------------------------------------------
-- Admin: the guest paid cash (or some other way) at hand-over.
-- ---------------------------------------------------------
create or replace function admin_mark_order_paid(p_order_id uuid, p_via text default 'cash')
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
  if p_via not in ('cash', 'other') then
    raise exception 'Payment method must be cash or other.' using errcode = 'P0001';
  end if;

  select * into o from orders where id = p_order_id for update;
  if o.id is null or o.status <> 'pending_payment' then
    raise exception 'Only an unpaid order can be marked paid.' using errcode = 'P0001';
  end if;

  update orders
  set status = 'paid', paid_at = now(), admin_note = 'Marked paid by admin (' || p_via || ')'
  where id = o.id
  returning * into o;
  return o;
end;
$$;
revoke all on function admin_mark_order_paid(uuid, text) from public, anon;
grant execute on function admin_mark_order_paid(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- Called by the shop and admin screens before they read stock, so stock
-- held by orders nobody paid for is released without needing a timer.
-- ---------------------------------------------------------
create or replace function release_expired_orders()
returns void
language sql
security definer set search_path = public
as $$
  select expire_stale_orders();
$$;
revoke all on function release_expired_orders() from public;
grant execute on function release_expired_orders() to anon, authenticated;

-- ---------------------------------------------------------
-- Everything the order emails need, behind the callback secret.
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

-- ---------------------------------------------------------
-- Storage for product photos: public read, admin write.
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_bucket_select_public" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "product_images_bucket_insert_admin" on storage.objects
  for insert with check (bucket_id = 'product-images' and is_admin());
create policy "product_images_bucket_update_admin" on storage.objects
  for update using (bucket_id = 'product-images' and is_admin());
create policy "product_images_bucket_delete_admin" on storage.objects
  for delete using (bucket_id = 'product-images' and is_admin());

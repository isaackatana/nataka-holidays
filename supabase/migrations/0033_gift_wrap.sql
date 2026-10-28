-- =========================================================
-- 0033_gift_wrap.sql
-- Optional gift wrapping at shop checkout.
--   * Settings -> "Gift wrap fee": one fixed fee per order (KSh). 0 means
--     gift wrapping is not offered.
--   * Guests tick "Gift wrap" and may add a short message (200 characters).
--   * The database adds the fee and keeps the message; the fee is never
--     discounted, and it is the database that decides whether wrapping is
--     offered, so it cannot be switched on from the browser.
--   * The packing slip and the order e-mails show it.
-- Run once in the Supabase SQL editor, after 0032, BEFORE deploying.
-- =========================================================

alter table business_settings
  add column shop_gift_wrap_fee int not null default 0
  check (shop_gift_wrap_fee between 0 and 100000);

alter table orders
  add column gift_wrap boolean not null default false,
  add column gift_wrap_fee int not null default 0 check (gift_wrap_fee >= 0),
  add column gift_message text check (gift_message is null or char_length(gift_message) <= 200);

drop function create_order(jsonb, text, text, text, text, text, text);

create or replace function create_order(
  p_items jsonb,
  p_fulfilment text,
  p_name text,
  p_phone text,
  p_handover_note text,
  p_address text,
  p_discount_code text default null,
  p_gift_wrap boolean default false,
  p_gift_message text default null
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
  wrap_fee int := 0;
  wrap_note text := null;
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

  if coalesce(p_gift_wrap, false) then
    select coalesce(shop_gift_wrap_fee, 0) into wrap_fee from business_settings limit 1;
    wrap_fee := coalesce(wrap_fee, 0);
    if wrap_fee <= 0 then
      raise exception 'Gift wrapping is not available.' using errcode = 'P0001';
    end if;
    wrap_note := nullif(trim(coalesce(p_gift_message, '')), '');
    if wrap_note is not null and char_length(wrap_note) > 200 then
      raise exception 'Keep the gift message under 200 characters.' using errcode = 'P0001';
    end if;
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
  set subtotal = sub, delivery_fee = fee, total = sub - disc_amount + fee + wrap_fee,
      discount_code = disc_code, discount_amount = disc_amount,
      gift_wrap = coalesce(p_gift_wrap, false), gift_wrap_fee = wrap_fee, gift_message = wrap_note
  where id = new_order.id
  returning * into new_order;

  return new_order;
end;
$$;
revoke all on function create_order(jsonb, text, text, text, text, text, text, boolean, text) from public, anon;
grant execute on function create_order(jsonb, text, text, text, text, text, text, boolean, text) to authenticated;

-- The order e-mail data now includes the gift wrap.
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
      'gift_wrap', o.gift_wrap, 'gift_wrap_fee', o.gift_wrap_fee, 'gift_message', o.gift_message,
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

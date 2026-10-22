-- =========================================================
-- 0025_experience_requests.sql
--
-- 1. Richer experience details: price basis (per person / per group),
--    category, what's included, meeting point, minimum age, what to bring,
--    maximum group size, cancellation terms. All optional. price_type is left
--    EMPTY for existing experiences on purpose: we don't know whether their
--    price is per person or per group, so no total is estimated until you set it.
--
-- 2. experience_requests: a guest asks to join an experience on a date with a
--    number of people. Works with or without an account. The estimated total
--    is worked out by the database from the experience's own price, never
--    trusted from the browser, and every new request starts as 'new'.
-- =========================================================

alter table experiences
  add column price_type text,
  add column category text,
  add column included text,
  add column meeting_point text,
  add column min_age int,
  add column what_to_bring text,
  add column max_group_size int,
  add column cancellation_policy text,
  add constraint experiences_price_type_valid check (price_type is null or price_type in ('per_person', 'per_group')),
  add constraint experiences_category_valid check (
    category is null or category in ('water', 'safari', 'culture', 'food', 'adventure', 'wellness', 'other')
  ),
  add constraint experiences_min_age_valid check (min_age is null or (min_age >= 0 and min_age <= 99)),
  add constraint experiences_max_group_valid check (max_group_size is null or (max_group_size >= 1 and max_group_size <= 500)),
  add constraint experiences_text_limits check (
    coalesce(char_length(included), 0) <= 2000
    and coalesce(char_length(meeting_point), 0) <= 500
    and coalesce(char_length(what_to_bring), 0) <= 2000
    and coalesce(char_length(cancellation_policy), 0) <= 2000
  );

create index idx_experiences_category on experiences (category);

-- ---------------------------------------------------------
-- experience_requests
-- ---------------------------------------------------------
create table experience_requests (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid references experiences(id) on delete set null,
  experience_title text not null,
  customer_id uuid references profiles(id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  preferred_date date not null,
  people int not null,
  message text,
  price_type text,
  unit_price numeric(10,2),
  estimated_total numeric(10,2),
  status text not null default 'new',
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experience_requests_status_valid check (status in ('new', 'confirmed', 'declined', 'cancelled', 'completed')),
  constraint experience_requests_people_valid check (people >= 1 and people <= 100),
  constraint experience_requests_text_limits check (
    char_length(guest_name) between 1 and 120
    and char_length(guest_email) between 3 and 254
    and char_length(guest_phone) between 5 and 40
    and coalesce(char_length(message), 0) <= 1000
  )
);

create index idx_experience_requests_status on experience_requests (status, created_at desc);
create index idx_experience_requests_customer on experience_requests (customer_id);
create index idx_experience_requests_experience on experience_requests (experience_id);

create trigger trg_experience_requests_updated_at
  before update on experience_requests
  for each row execute function set_updated_at();

-- Fills in everything the database should decide, and refuses bad requests.
create or replace function experience_request_before_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  exp experiences%rowtype;
  today_eat date := (now() at time zone 'Africa/Nairobi')::date;
begin
  select * into exp from experiences where id = new.experience_id;
  if not found or not exp.is_published then
    raise exception 'That experience is not available.' using errcode = '23514';
  end if;

  if new.preferred_date < today_eat then
    raise exception 'Please choose a date that has not passed.' using errcode = '23514';
  end if;

  if exp.max_group_size is not null and new.people > exp.max_group_size then
    raise exception 'This experience takes at most % people.', exp.max_group_size using errcode = '23514';
  end if;

  new.experience_title := exp.title;
  new.price_type := exp.price_type;
  new.unit_price := exp.price;
  new.estimated_total := case
    when exp.price is null or exp.price_type is null then null
    when exp.price_type = 'per_group' then exp.price
    else exp.price * new.people
  end;

  if not is_admin() then
    new.status := 'new';
    new.notified_at := null;
    -- A signed-in guest's request is always theirs; an anonymous one has no owner.
    new.customer_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger trg_experience_requests_before_insert
  before insert on experience_requests
  for each row execute function experience_request_before_insert();

alter table experience_requests enable row level security;

-- Anyone may send a request (no account needed). They cannot read it back:
-- only the signed-in owner and admins can.
create policy "experience_requests_insert_anyone"
  on experience_requests for insert
  with check (true);

create policy "experience_requests_select_own_or_admin"
  on experience_requests for select
  using (is_admin() or (customer_id is not null and customer_id = auth.uid()));

create policy "experience_requests_update_admin"
  on experience_requests for update
  using (is_admin()) with check (is_admin());

create policy "experience_requests_delete_admin"
  on experience_requests for delete
  using (is_admin());

-- ---------------------------------------------------------
-- Email support (called by api/notify-experience.js with the server secret)
-- ---------------------------------------------------------
create or replace function experience_request_context(p_secret text, p_request_id uuid)
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
    'request', jsonb_build_object(
      'id', r.id, 'experience_title', r.experience_title, 'guest_name', r.guest_name,
      'guest_email', r.guest_email, 'guest_phone', r.guest_phone,
      'preferred_date', r.preferred_date, 'people', r.people, 'message', r.message,
      'price_type', r.price_type, 'unit_price', r.unit_price,
      'estimated_total', r.estimated_total, 'status', r.status,
      'notified', r.notified_at is not null
    ),
    'meeting_point', (select e.meeting_point from experiences e where e.id = r.experience_id),
    'business', (
      select jsonb_build_object('name', s.business_name, 'phone', s.contact_phone, 'email', s.contact_email)
      from business_settings s limit 1
    )
  )
  into result
  from experience_requests r where r.id = p_request_id;

  return result;
end;
$$;

-- Marks the emails as sent. Returns true only for the first caller, so two
-- near-simultaneous calls can't both send.
create or replace function claim_experience_request_notification(p_secret text, p_request_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
  claimed int;
begin
  select value into expected from app_secrets where key = 'mpesa_callback_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid secret' using errcode = '42501';
  end if;

  update experience_requests
     set notified_at = now()
   where id = p_request_id and notified_at is null and status = 'new';
  get diagnostics claimed = row_count;
  return claimed = 1;
end;
$$;

-- If sending fails entirely, release the claim so a retry can send.
create or replace function release_experience_request_notification(p_secret text, p_request_id uuid)
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
  update experience_requests set notified_at = null where id = p_request_id and status = 'new';
end;
$$;

revoke all on function experience_request_context(text, uuid) from public;
revoke all on function claim_experience_request_notification(text, uuid) from public;
revoke all on function release_experience_request_notification(text, uuid) from public;
grant execute on function experience_request_context(text, uuid) to anon, authenticated;
grant execute on function claim_experience_request_notification(text, uuid) to anon, authenticated;
grant execute on function release_experience_request_notification(text, uuid) to anon, authenticated;

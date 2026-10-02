-- =========================================================
-- 0012_security_hardening.sql   *** RUN THIS BEFORE LAUNCH ***
--
-- Fixes found in the pre-launch review. The earlier row-level-security
-- rules decided WHO may write a row, but not WHICH COLUMNS they may set,
-- so a signed-in user could:
--   1. promote themselves to admin (update their own profiles.role),
--   2. approve their own reviews (set reviews.status = 'approved'),
--   3. insert a booking already 'confirmed' (blocking a property's dates)
--      or 'completed' (unlocking reviews on stays they never took),
--   4. set their own estimated_total, which guest self-pay then trusts.
-- Anyone could also post unlimited-size text into bookings/contact forms.
--
-- Edits made directly in the Supabase SQL editor or by the service role
-- have auth.uid() = null and are deliberately NOT blocked by the role and
-- review guards, so you can still promote an admin from the dashboard.
-- =========================================================

-- ---------- 1. Nobody can change their own role ----------
create or replace function protect_profile_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    raise exception 'You cannot change your own role.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_protect_role
  before update on profiles
  for each row execute function protect_profile_role();

-- ---------- 2. Reviews: always start pending; owners can't self-approve ----------
create or replace function guard_review_write()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then
    return new; -- dashboard / service role / admin moderation
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    -- A review may only point at the reviewer's own completed stay here.
    if new.booking_id is not null and not exists (
      select 1 from bookings b
      where b.id = new.booking_id
        and b.customer_id = auth.uid()
        and b.property_id = new.property_id
        and b.status = 'completed'
    ) then
      raise exception 'That booking is not a completed stay of yours at this property.'
        using errcode = '42501';
    end if;
  else
    -- Owners may edit rating/comment only; an edit goes back to moderation.
    new.property_id := old.property_id;
    new.customer_id := old.customer_id;
    new.booking_id := old.booking_id;
    if new.rating is distinct from old.rating or new.comment is distinct from old.comment then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_reviews_guard
  before insert or update on reviews
  for each row execute function guard_review_write();

-- ---------- 3. Bookings: public enquiries are always 'pending' ----------
drop policy "bookings_insert_anyone" on bookings;
create policy "bookings_insert_anyone"
  on bookings for insert
  with check (
    is_admin()
    or (
      status = 'pending'
      and (customer_id is null or customer_id = auth.uid())
    )
  );

-- ---------- 4. Estimated total is computed here, not trusted from the browser ----------
create or replace function set_booking_estimate()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  p properties%rowtype;
begin
  if is_admin() or new.property_id is null then
    return new;
  end if;
  select * into p from properties where id = new.property_id;
  if found then
    new.estimated_total := (new.check_out - new.check_in) * p.price_per_night + p.cleaning_fee;
  end if;
  return new;
end;
$$;

create trigger trg_bookings_estimate
  before insert on bookings
  for each row execute function set_booking_estimate();

-- ---------- 5. Size limits on public text (NOT VALID = applies to new rows only) ----------
alter table bookings
  add constraint bookings_text_limits check (
    char_length(guest_name) <= 120
    and char_length(guest_email) <= 254
    and char_length(guest_phone) <= 40
    and coalesce(char_length(message), 0) <= 2000
    and guests between 1 and 100
  ) not valid;

drop policy "contact_messages_insert_anyone" on contact_messages;
create policy "contact_messages_insert_anyone"
  on contact_messages for insert
  with check (
    is_read = false
    and char_length(name) between 1 and 120
    and char_length(email) between 3 and 254
    and char_length(message) between 1 and 5000
    and coalesce(char_length(phone), 0) <= 40
    and coalesce(char_length(subject), 0) <= 200
  );

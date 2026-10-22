-- =========================================================
-- 0026_experience_reviews.sql
-- Guests can review an experience they took. Same idea and same safeguards
-- as stay reviews (0001-0024), in their own table:
--   * only the guest who made a request that you marked COMPLETED can review it
--   * one review per request
--   * every new review, and every edit, starts as 'pending' until you approve it
--   * guests cannot write the business reply or choose the shown name
--   * the public sees only approved reviews
-- =========================================================

create table experience_reviews (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  request_id uuid references experience_requests(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  status review_status not null default 'pending',
  reviewer_name text,
  owner_reply text,
  owner_replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experience_reviews_comment_length check (comment is null or char_length(comment) <= 1000),
  constraint experience_reviews_reply_length check (owner_reply is null or char_length(owner_reply) <= 1000)
);

create unique index uq_experience_reviews_request on experience_reviews (request_id) where request_id is not null;
create index idx_experience_reviews_experience on experience_reviews (experience_id, status);
create index idx_experience_reviews_customer on experience_reviews (customer_id);

create trigger trg_experience_reviews_updated_at
  before update on experience_reviews
  for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Rules a guest cannot get around
-- ---------------------------------------------------------
create or replace function guard_experience_review_write()
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
    if new.request_id is null or not exists (
      select 1 from experience_requests r
      where r.id = new.request_id
        and r.customer_id = auth.uid()
        and r.experience_id = new.experience_id
        and r.status = 'completed'
    ) then
      raise exception 'You can only review an experience you have completed.' using errcode = '42501';
    end if;
  else
    new.experience_id := old.experience_id;
    new.customer_id := old.customer_id;
    new.request_id := old.request_id;
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

create trigger trg_experience_reviews_guard
  before insert or update on experience_reviews
  for each row execute function guard_experience_review_write();

-- The shown name ("Amina K.") is set from the guest's profile, never by the guest.
create or replace function set_experience_review_name()
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

create trigger trg_experience_reviews_name
  before insert or update on experience_reviews
  for each row execute function set_experience_review_name();

-- ---------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------
alter table experience_reviews enable row level security;

create policy "experience_reviews_select_approved_or_own_or_admin"
  on experience_reviews for select
  using (status = 'approved' or customer_id = auth.uid() or is_admin());

create policy "experience_reviews_insert_own"
  on experience_reviews for insert
  with check (customer_id = auth.uid());

create policy "experience_reviews_update_own_or_admin"
  on experience_reviews for update
  using (customer_id = auth.uid() or is_admin())
  with check (customer_id = auth.uid() or is_admin());

create policy "experience_reviews_delete_admin"
  on experience_reviews for delete
  using (is_admin());

-- ---------------------------------------------------------
-- Average rating and count per experience (approved reviews only), one call for all
-- ---------------------------------------------------------
create or replace function experience_rating_stats()
returns table (experience_id uuid, average numeric, review_count int)
language sql
security definer set search_path = public
stable
as $$
  select r.experience_id,
         round(avg(r.rating)::numeric, 1) as average,
         count(*)::int as review_count
  from experience_reviews r
  where r.status = 'approved'
  group by r.experience_id;
$$;

revoke all on function experience_rating_stats() from public;
grant execute on function experience_rating_stats() to anon, authenticated;

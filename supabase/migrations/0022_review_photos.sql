-- =========================================================
-- 0022_review_photos.sql
-- Guests can attach up to 3 photos to their review.
--
--   * Photos live in the public 'review-images' bucket under
--     <guest id>/<random id>.<ext> (unguessable). Only a guest with a
--     completed stay can upload, only into their own folder, and the bucket
--     itself refuses anything but small images.
--   * review_images rows are visible exactly when their review is (approved,
--     or the viewer's own, or admin) because the policy defers to the
--     reviews table's own row-level security.
--   * Adding or removing a photo sends the review back to Pending, so a
--     photo can't be swapped in after approval without you seeing it.
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-images', 'review-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "review_images_bucket_select_public"
  on storage.objects for select
  using (bucket_id = 'review-images');

create policy "review_images_bucket_insert_guest"
  on storage.objects for insert
  with check (
    bucket_id = 'review-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from bookings b
      where b.customer_id = auth.uid() and b.status = 'completed'
    )
  );

create policy "review_images_bucket_delete_own_or_admin"
  on storage.objects for delete
  using (
    bucket_id = 'review-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

-- ---------------------------------------------------------
-- review_images table
-- ---------------------------------------------------------
create table review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index idx_review_images_review on review_images (review_id);

alter table review_images enable row level security;

-- Defers to the reviews policies: approved reviews are public, a guest sees
-- their own, admins see all.
create policy "review_images_select_with_review"
  on review_images for select
  using (exists (select 1 from reviews r where r.id = review_id));

create policy "review_images_insert_own_review"
  on review_images for insert
  with check (
    exists (select 1 from reviews r where r.id = review_id and r.customer_id = auth.uid())
    and storage_path like auth.uid()::text || '/%'
  );

create policy "review_images_delete_own_or_admin"
  on review_images for delete
  using (
    is_admin()
    or exists (select 1 from reviews r where r.id = review_id and r.customer_id = auth.uid())
  );

-- At most 3 photos per review.
create or replace function guard_review_image_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (select count(*) from review_images where review_id = new.review_id) >= 3 then
    raise exception 'A review can have at most 3 photos.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_review_images_limit
  before insert on review_images
  for each row execute function guard_review_image_insert();

-- A guest adding/removing a photo sends the review back to Pending.
create or replace function review_images_repend()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target uuid := coalesce(new.review_id, old.review_id);
begin
  if auth.uid() is not null and not is_admin() then
    update reviews set status = 'pending' where id = target and status <> 'pending';
  end if;
  return null;
end;
$$;

create trigger trg_review_images_repend
  after insert or delete on review_images
  for each row execute function review_images_repend();

-- The review guard blanks any status change a guest makes directly. The
-- repend update above runs from inside a trigger (depth > 1), which a guest
-- cannot do themselves, so it is allowed through.
create or replace function guard_review_write()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() or pg_trigger_depth() > 1 then
    return new; -- dashboard / service role / admin moderation / photo repend
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.owner_reply := null;
    new.owner_replied_at := null;
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

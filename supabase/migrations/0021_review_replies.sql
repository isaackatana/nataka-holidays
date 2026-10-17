-- =========================================================
-- 0021_review_replies.sql
-- Lets the business reply publicly to a review. The reply is shown under
-- the review on the property page (once the review itself is approved).
-- Only admins can write it: the guard trigger below blanks any attempt by a
-- guest to set or change a reply, whether inserting or editing their review.
-- =========================================================

alter table reviews
  add column owner_reply text,
  add column owner_replied_at timestamptz,
  add constraint reviews_owner_reply_length
    check (owner_reply is null or char_length(owner_reply) <= 1000);

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

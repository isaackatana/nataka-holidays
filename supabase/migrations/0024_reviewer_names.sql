-- =========================================================
-- 0024_reviewer_names.sql
-- Public reviews need the guest's name, but guest profiles are private (and
-- should stay that way). So each review stores a short display name, set by
-- the database from the guest's profile: first name + last initial
-- ("Amina K."). Guests can't choose or change it.
-- =========================================================

alter table reviews add column reviewer_name text;

create or replace function review_display_name(p_customer uuid)
returns text
language plpgsql
security definer set search_path = public
stable
as $$
declare
  full_name_text text;
  parts text[];
  first_name text;
  last_initial text;
begin
  select trim(p.full_name) into full_name_text from profiles p where p.id = p_customer;
  if full_name_text is null or full_name_text = '' then
    return 'Guest';
  end if;
  parts := regexp_split_to_array(full_name_text, '\s+');
  first_name := initcap(left(parts[1], 30));
  if array_length(parts, 1) > 1 then
    last_initial := upper(left(parts[array_length(parts, 1)], 1));
    return first_name || ' ' || last_initial || '.';
  end if;
  return first_name;
end;
$$;

revoke all on function review_display_name(uuid) from public;

-- Fill in the name for reviews that already exist.
update reviews set reviewer_name = review_display_name(customer_id) where reviewer_name is null;

create or replace function set_review_reviewer_name()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.reviewer_name := review_display_name(new.customer_id);
  else
    new.reviewer_name := old.reviewer_name; -- never changed by an edit
  end if;
  return new;
end;
$$;

create trigger trg_reviews_reviewer_name
  before insert or update on reviews
  for each row execute function set_review_reviewer_name();

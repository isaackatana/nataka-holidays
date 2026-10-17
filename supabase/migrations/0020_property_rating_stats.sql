-- =========================================================
-- 0020_property_rating_stats.sql
-- One cheap call that returns the average rating and review count for every
-- property with at least one APPROVED review, so listing cards can show
-- stars without loading every review. Only approved reviews are counted.
-- =========================================================

create or replace function property_rating_stats()
returns table (property_id uuid, average numeric, review_count int)
language sql
security definer set search_path = public
stable
as $$
  select r.property_id,
         round(avg(r.rating)::numeric, 1) as average,
         count(*)::int as review_count
  from reviews r
  where r.status = 'approved'
  group by r.property_id;
$$;

revoke all on function property_rating_stats() from public;
grant execute on function property_rating_stats() to anon, authenticated;

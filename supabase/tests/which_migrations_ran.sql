-- Paste into the Supabase SQL Editor and run. Every column should say true
-- for the features you want to use. A false means that migration still needs
-- running (in number order).
select
  exists (select 1 from pg_constraint where conname = 'reviews_comment_length')            as "0018_review_limits",
  exists (select 1 from pg_proc where proname = 'bookings_due_review_request')             as "0019_review_requests",
  exists (select 1 from pg_proc where proname = 'property_rating_stats')                   as "0020_property_rating_stats",
  exists (select 1 from information_schema.columns
          where table_name = 'reviews' and column_name = 'owner_reply')                    as "0021_review_replies",
  to_regclass('public.review_images') is not null                                          as "0022_review_photos",
  coalesce((select pg_get_functiondef(p.oid) like '%''review''%'
            from pg_proc p where p.proname = 'notification_context' limit 1), false)       as "0023_review_alert",
  exists (select 1 from information_schema.columns
          where table_name = 'reviews' and column_name = 'reviewer_name')                  as "0024_reviewer_names";

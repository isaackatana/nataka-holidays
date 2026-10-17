-- =========================================================
-- 0018_review_limits.sql
-- Guests can now write reviews from My Bookings. Cap the comment length
-- in the database too (the form limits it, but the API is open to
-- signed-in guests), and keep ratings whole numbers 1-5 (already enforced).
-- =========================================================
alter table reviews
  add constraint reviews_comment_length
  check (comment is null or char_length(comment) <= 1000);

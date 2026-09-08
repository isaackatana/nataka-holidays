-- =========================================================
-- 0006_video_urls.sql
-- Adds video support to properties, experiences, and the homepage hero.
-- Deliberately a URL field, not a Storage-backed upload like the photo
-- galleries: video files are an order of magnitude larger than photos
-- (tens to hundreds of MB), and a robust upload pipeline for that
-- (chunked/resumable upload, progress, compression/transcoding) is a
-- much bigger undertaking than the image uploaders built for
-- property_images/experience_images. Pasting a link (YouTube, Vimeo, or
-- a direct-hosted file URL) is standard practice for this exact reason
-- on small business sites and keeps the admin experience simple.
--
-- No RLS policy changes needed — these are new nullable columns on
-- tables that already have RLS enabled with existing policies
-- (properties_select_published_or_admin, experiences_select_published_or_admin,
-- business_settings_select_all/update_admin from earlier migrations);
-- column additions inherit the existing row-level policies automatically.
-- =========================================================

alter table properties add column video_url text;
alter table experiences add column video_url text;

alter table business_settings add column hero_video_url text;
alter table business_settings add column hero_image_url text;

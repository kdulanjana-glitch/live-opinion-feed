-- ============================================================
-- Peolia — allow GIF uploads to the senti-images bucket
-- Run in Supabase Dashboard → SQL Editor (one-off).
--
-- The bucket was created with jpeg/png/webp only. The Float screen's new
-- "GIF" option uploads image/gif, so add it to the allowed MIME types.
-- ============================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'senti-images';

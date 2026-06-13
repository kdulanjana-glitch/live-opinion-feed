-- ============================================================
-- Peolia Sprint 2 — Run in Supabase Dashboard → SQL Editor
--
-- 1. sentarium_feed v2 — fix creator avatar + enable profile nav
-- 2. senti-images storage bucket + policies (image picker)
--
-- Safe to run once. Re-running is harmless (policies are
-- dropped/recreated, bucket insert is ON CONFLICT DO NOTHING).
-- ============================================================

-- ── 1. sentarium_feed v2 ────────────────────────────────────
-- The old view returned avatar_initials from the stale stored
-- users.avatar_initials column (always '??') and did NOT expose
-- the creator's user_id, so the client could never navigate to
-- the creator's profile.
--
-- CREATE OR REPLACE keeps the existing columns in their original
-- order (a Postgres requirement) and appends user_id + avatar_url
-- at the end. avatar_initials is now computed live from username.

CREATE OR REPLACE VIEW public.sentarium_feed AS
SELECT
  s.id,
  s.question,
  s.description,
  s.wave,
  s.image_url,
  s.created_at,
  u.username,
  UPPER(LEFT(COALESCE(u.username, '?'), 1)) AS avatar_initials,
  COALESCE(c.yes_count, 0)    AS yes_count,
  COALESCE(c.hmm_count, 0)    AS hmm_count,
  COALESCE(c.nah_count, 0)    AS nah_count,
  COALESCE(c.total_reacts, 0) AS total_reacts,
  COALESCE(c.likes, 0)        AS likes,
  COALESCE(c.pins, 0)         AS pins,
  COALESCE(c.voices, 0)       AS voices,
  COALESCE(c.velocity_2h, 0)  AS velocity_2h,
  s.user_id,
  u.avatar_url
FROM public.sentis s
LEFT JOIN public.users u        ON u.id = s.user_id
LEFT JOIN public.senti_counts c ON c.senti_id = s.id
WHERE s.status = 'approved';

-- If the statement above fails with "cannot change data type of view
-- column", the original view used different expressions. In that case
-- run:  DROP VIEW public.sentarium_feed;  and re-run the CREATE above
-- (nothing else depends on the view — only the app queries it).

-- ── 2. senti-images storage bucket ──────────────────────────
-- Public-read bucket for senti images. Uploads are restricted to
-- signed-in users writing into their own {user_id}/ folder.
-- 5 MB cap, images only. Objects are immutable (no update/delete
-- policies) — abandoned images can be garbage-collected later.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'senti-images',
  'senti-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "senti_images_public_read" ON storage.objects;
CREATE POLICY "senti_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'senti-images');

DROP POLICY IF EXISTS "senti_images_owner_upload" ON storage.objects;
CREATE POLICY "senti_images_owner_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'senti-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

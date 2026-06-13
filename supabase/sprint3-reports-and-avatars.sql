-- ============================================================
-- Peolia Sprint 3 — Run in Supabase Dashboard → SQL Editor
--
-- 1. senti_reports table — "Flag" a senti for moderation
--    (Google Play UGC requirement: users can report objectionable content)
--
-- Profile-picture upload needs NO SQL: avatars are stored in the existing
-- senti-images bucket under {user_id}/avatar-*.jpg (the senti_images_owner_upload
-- policy already restricts uploads to each user's own folder, and public read
-- already covers them).
--
-- Safe to run once; policies are dropped/recreated.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.senti_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  senti_id    uuid NOT NULL REFERENCES public.sentis(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  reason      text NOT NULL CHECK (reason IN (
                'spam', 'harassment', 'hate', 'misinformation',
                'sexual', 'violence', 'other')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  status      text NOT NULL DEFAULT 'pending',
  UNIQUE (senti_id, reporter_id)   -- one report per user per senti
);

ALTER TABLE public.senti_reports ENABLE ROW LEVEL SECURITY;

-- A signed-in user may file a report as themselves (reporter_id = their uid).
DROP POLICY IF EXISTS senti_reports_insert_own ON public.senti_reports;
CREATE POLICY senti_reports_insert_own
  ON public.senti_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- A user can read back their own reports (e.g. to know they already reported).
DROP POLICY IF EXISTS senti_reports_select_own ON public.senti_reports;
CREATE POLICY senti_reports_select_own
  ON public.senti_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- No UPDATE/DELETE policies → reports are immutable from the client.
-- Moderation happens dashboard-side (service role bypasses RLS).

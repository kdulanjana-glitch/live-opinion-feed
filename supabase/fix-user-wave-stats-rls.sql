-- ============================================================
-- Peolia — fix user_wave_stats RLS (onboarding wave picker)
-- Run in Supabase Dashboard → SQL Editor.
--
-- user_wave_stats had RLS enabled + a read policy but NO insert/update
-- policy, so the onboarding upsert failed with 42501. Allow a signed-in
-- user to seed/update their own wave rows.
-- ============================================================

ALTER TABLE public.user_wave_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_wave_stats_insert_own ON public.user_wave_stats;
CREATE POLICY user_wave_stats_insert_own ON public.user_wave_stats
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_wave_stats_update_own ON public.user_wave_stats;
CREATE POLICY user_wave_stats_update_own ON public.user_wave_stats
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Peolia Sprint 5 — Run in Supabase Dashboard → SQL Editor
--
-- 1. Fix the Follow button (RLS + SECURITY DEFINER on follows triggers)
-- 2. user_private table for phone / birthday / gender (kept OUT of the
--    publicly-readable users table)
-- ============================================================

-- ── 1. follows RLS ──────────────────────────────────────────
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Social graph is public (needed for followers/following lists + follow state)
DROP POLICY IF EXISTS follows_select_all ON public.follows;
CREATE POLICY follows_select_all ON public.follows
  FOR SELECT USING (true);

-- You can only create/remove your OWN follow rows
DROP POLICY IF EXISTS follows_insert_own ON public.follows;
CREATE POLICY follows_insert_own ON public.follows
  FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS follows_delete_own ON public.follows;
CREATE POLICY follows_delete_own ON public.follows
  FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- Make every trigger function on follows SECURITY DEFINER + fixed search_path,
-- so the follower/following count triggers can write user_stats under RLS.
-- (Same class of fix applied to likes/pins/reactions on 2026-06-12.)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT p.oid::regprocedure AS fn
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.follows'::regclass AND NOT t.tgisinternal
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', r.fn);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.fn);
  END LOOP;
END $$;

-- ── 2. user_private (sensitive profile fields) ──────────────
CREATE TABLE IF NOT EXISTS public.user_private (
  user_id    uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  phone      text,
  birthday   date,
  gender     text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_private ENABLE ROW LEVEL SECURITY;

-- Only the owner can read/write their private row
DROP POLICY IF EXISTS user_private_select_own ON public.user_private;
CREATE POLICY user_private_select_own ON public.user_private
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_private_insert_own ON public.user_private;
CREATE POLICY user_private_insert_own ON public.user_private
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_private_update_own ON public.user_private;
CREATE POLICY user_private_update_own ON public.user_private
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

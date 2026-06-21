-- ============================================================
-- Peolia Sprint 7 — Block user  (Google Play UGC requirement)
-- Run in Supabase Dashboard → SQL Editor.
--
-- When citizen A blocks citizen B:
--   • A no longer sees B's sentis in feed / trending / profile (and vice-versa —
--     blocking is mutually invisible, enforced via get_blocked_ids()).
--   • Any follow edges between A and B are removed.
--
-- Safe to run more than once; table/policies/functions are create-or-replace.
-- ============================================================

-- ── Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)          -- can't block yourself
);

-- Reverse lookup ("who blocked me") used by get_blocked_ids().
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx
  ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- A user manages only their OWN block rows (blocker_id = their uid).
-- Reading is restricted to own rows too — the "who blocked me" direction is
-- exposed only through the SECURITY DEFINER get_blocked_ids() helper below, so
-- a client can filter that content without learning who blocked them.
DROP POLICY IF EXISTS user_blocks_insert_own ON public.user_blocks;
CREATE POLICY user_blocks_insert_own
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_delete_own ON public.user_blocks;
CREATE POLICY user_blocks_delete_own
  ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own
  ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

-- ── block_user(target) ──────────────────────────────────────
-- Inserts the block (idempotent) and tears down follow edges both ways.
-- SECURITY DEFINER so it can delete the target's follow-of-me row, which the
-- caller's RLS would otherwise forbid.
CREATE OR REPLACE FUNCTION public.block_user(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL OR target IS NULL OR me = target THEN
    RETURN;
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (me, target)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.follows
  WHERE (follower_id = me AND following_id = target)
     OR (follower_id = target AND following_id = me);
END;
$$;

-- ── unblock_user(target) ────────────────────────────────────
-- Removes my block of target. Does NOT restore follow edges.
CREATE OR REPLACE FUNCTION public.unblock_user(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL OR target IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.user_blocks
  WHERE blocker_id = me AND blocked_id = target;
END;
$$;

-- ── get_blocked_ids() ───────────────────────────────────────
-- Returns the UNION of users I blocked AND users who blocked me — the full set
-- whose content must be hidden from me. SECURITY DEFINER so the "blocked me"
-- direction is included without granting the caller direct read of those rows.
CREATE OR REPLACE FUNCTION public.get_blocked_ids()
RETURNS TABLE (user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT blocked_id  FROM public.user_blocks WHERE blocker_id = auth.uid()
  UNION
  SELECT blocker_id  FROM public.user_blocks WHERE blocked_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.block_user(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_blocked_ids()  TO authenticated;

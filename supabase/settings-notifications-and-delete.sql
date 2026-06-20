-- ============================================================
-- Peolia — Settings: notification prefs + account deletion
-- Run in Supabase Dashboard → SQL Editor → New query.
-- Required before testing the General > Notifications toggles
-- and the Danger Zone > Delete account flow.
-- ============================================================

-- ── 1. notification_prefs ─────────────────────────────────────────────
-- One row per user; all four channels default to TRUE (opt-out model,
-- matching the SettingsScreen "missing row = all on" behavior).
CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id       uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  notify_react  boolean NOT NULL DEFAULT true,
  notify_voice  boolean NOT NULL DEFAULT true,
  notify_reply  boolean NOT NULL DEFAULT true,
  notify_follow boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

-- Own-row only: insert / select / update your own prefs.
DROP POLICY IF EXISTS notification_prefs_own ON public.notification_prefs;
CREATE POLICY notification_prefs_own ON public.notification_prefs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. users.deleted_at ───────────────────────────────────────────────
-- Soft-delete marker set by the delete-account edge function. A scheduled
-- job can hard-delete rows older than the 30-day grace window.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ── 3. Deploy the edge function (run in a terminal, not here) ──────────
-- npx supabase functions deploy delete-account --project-ref cobmoxjxwapinxcnmwhf
-- (It uses the service role + auth admin ban, so no extra SQL is needed.)

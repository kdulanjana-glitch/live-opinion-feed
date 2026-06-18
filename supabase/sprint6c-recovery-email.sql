-- ============================================================
-- Peolia Sprint 6c — Optional recovery email (private)
-- Run in Supabase Dashboard → SQL Editor (idempotent).
--
-- A phone-signup account's auth.users.email is a synthetic placeholder
-- (<digits>@phone.peolia.invalid), so it can't be used for recovery. This adds
-- an OPTIONAL real email the user can supply at phone signup. It lives in
-- user_private (own-row RLS) — never the public users table — because it is
-- PII only ever read by the owner or a service-role recovery flow.
-- ============================================================

ALTER TABLE public.user_private
  ADD COLUMN IF NOT EXISTS recovery_email text;

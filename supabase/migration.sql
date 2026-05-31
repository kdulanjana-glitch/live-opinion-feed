-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor → New query
-- BEFORE running the seed script
-- ============================================================

ALTER TABLE opinions ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

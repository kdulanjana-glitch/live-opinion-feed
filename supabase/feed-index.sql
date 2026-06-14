-- ============================================================
-- Peolia — feed performance index
-- Run in Supabase Dashboard → SQL Editor (one-off).
--
-- sentarium_feed filters status='approved' and orders by created_at DESC.
-- This partial index lets Postgres satisfy that ORDER BY ... LIMIT with an
-- index scan instead of sorting the whole table as the senti count grows.
-- ============================================================

CREATE INDEX IF NOT EXISTS sentis_approved_created_idx
  ON public.sentis (created_at DESC)
  WHERE status = 'approved';

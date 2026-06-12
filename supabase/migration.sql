-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor → New query
-- BEFORE running the seed script
-- ============================================================

ALTER TABLE opinions ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- ── Peolia vote system migration ─────────────────────────────────────────────
-- The old UI used 'agree' / 'disagree'. Peolia VoteBar sends 'yes' / 'hmm' / 'nah'.
-- Drop the old 2-value check constraint and replace with one that accepts all 5.
-- Run this ONCE after deploying the Peolia UI update.

ALTER TABLE votes
  DROP CONSTRAINT IF EXISTS votes_vote_value_check;

ALTER TABLE votes
  ADD CONSTRAINT votes_vote_value_check
  CHECK (vote_value IN ('agree', 'disagree', 'yes', 'hmm', 'nah'));

-- ── Opinions category constraint expansion ────────────────────────────────────
-- Original constraint only allowed 5 categories. Expanded to all 13.
-- Run this ONCE after deploying the Peolia UI update.

ALTER TABLE opinions DROP CONSTRAINT IF EXISTS opinions_category_check;

ALTER TABLE opinions ADD CONSTRAINT opinions_category_check
  CHECK (category IN (
    'love','money','life','tech','society',
    'politics','food','health','sports',
    'entertainment','science','education','environment'
  ));

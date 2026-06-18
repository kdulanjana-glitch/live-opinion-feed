-- ============================================================
-- Peolia Sprint 6b — Close the leak (run LAST)
--
-- Only run this AFTER:
--   1. sprint6-field-privacy.sql has run (data backfilled into user_private)
--   2. the app build that writes phone/dob/gender to user_private is deployed
--   3. phone-signup + phone-change edge functions are redeployed
--
-- Dropping these columns removes the publicly-readable copies of the PII so a
-- "private" toggle actually means private. There is no going back without the
-- backfill, so confirm user_private is populated before running.
-- ============================================================

ALTER TABLE public.users DROP COLUMN IF EXISTS phone;
ALTER TABLE public.users DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE public.users DROP COLUMN IF EXISTS gender;

-- ============================================================
-- Peolia Sprint 6d — Fix username cooldown blocking first-ever set
-- Run in Supabase Dashboard → SQL Editor (idempotent).
--
-- Bug: the cooldown trigger raised 'username_cooldown_active' on the INITIAL
-- username set during onboarding, because it didn't distinguish "first set"
-- (old.username IS NULL) from "changing an existing handle". This replaces it
-- with logic that only enforces the 14-day window on a genuine change.
-- ============================================================

-- Ensure the bookkeeping column exists (nullable, no default — a NULL means
-- "never set", so the first set is never treated as a recent change).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;

-- Drop any existing cooldown trigger on users, whatever it's named, by matching
-- the function it calls to the one that raises username_cooldown_active.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.users'::regclass
      AND NOT t.tgisinternal
      AND pg_get_functiondef(p.oid) ILIKE '%username_cooldown_active%'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.users', r.tgname);
  END LOOP;
END $$;

-- Corrected enforcement.
CREATE OR REPLACE FUNCTION public.enforce_username_cooldown()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    -- Block only when changing an ALREADY-SET username inside the 14-day window.
    IF OLD.username IS NOT NULL
       AND OLD.username_changed_at IS NOT NULL
       AND OLD.username_changed_at > now() - interval '14 days' THEN
      RAISE EXCEPTION 'username_cooldown_active';
    END IF;
    -- Stamp the change time (also starts the clock on the first-ever set).
    NEW.username_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_username_cooldown ON public.users;
CREATE TRIGGER trg_username_cooldown
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_username_cooldown();

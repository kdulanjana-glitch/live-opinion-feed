-- ============================================================
-- Peolia Sprint 6 — Per-field profile privacy
-- Run in Supabase Dashboard → SQL Editor (idempotent; safe to re-run).
--
-- Goal: phone / date-of-birth / gender become PRIVATE BY DEFAULT, living only
-- in user_private (own-row RLS). The owner decides, per field, whether other
-- users may see it (phone_public / dob_public / gender_public). Outsiders read
-- those fields only through get_public_profile(), which obeys the flags.
--
-- Run ORDER: this migration first → redeploy app + edge functions → then run
-- sprint6b-drop-public-pii.sql to remove the now-unused public users columns.
-- ============================================================

-- ── 1. Per-field visibility flags (default = private) ───────
ALTER TABLE public.user_private
  ADD COLUMN IF NOT EXISTS phone_public  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dob_public    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gender_public boolean NOT NULL DEFAULT false;

-- ── 2. Phone uniqueness (enforced here now that phone lives in user_private) ──
-- Partial unique index: ignores NULL phones, blocks duplicate numbers.
CREATE UNIQUE INDEX IF NOT EXISTS user_private_phone_unique
  ON public.user_private (phone)
  WHERE phone IS NOT NULL;

-- ── 3. Backfill from the public users columns into user_private ─────────────
-- Keeps any value already in user_private; fills gaps from users.*.
INSERT INTO public.user_private (user_id, phone, birthday, gender)
SELECT u.id, u.phone, u.date_of_birth, u.gender
FROM public.users u
WHERE u.phone IS NOT NULL
   OR u.date_of_birth IS NOT NULL
   OR u.gender IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  phone    = COALESCE(public.user_private.phone,    EXCLUDED.phone),
  birthday = COALESCE(public.user_private.birthday, EXCLUDED.birthday),
  gender   = COALESCE(public.user_private.gender,   EXCLUDED.gender);

-- Normalize gender to canonical lowercase tokens (older EditProfileSheet rows
-- stored label-cased values like 'Male' / 'Prefer not to say').
UPDATE public.user_private SET gender = CASE lower(gender)
  WHEN 'male'              THEN 'male'
  WHEN 'female'            THEN 'female'
  WHEN 'other'            THEN 'other'
  WHEN 'prefer not to say' THEN 'prefer_not_to_say'
  WHEN 'prefer_not_to_say' THEN 'prefer_not_to_say'
  ELSE gender
END
WHERE gender IS NOT NULL;

-- ── 4. Date of birth is permanent ──────────────────────────
-- Once set, birthday cannot be changed (matches onboarding's permanence copy).
CREATE OR REPLACE FUNCTION public.prevent_birthday_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.birthday IS NOT NULL AND NEW.birthday IS DISTINCT FROM OLD.birthday THEN
    RAISE EXCEPTION 'Date of birth cannot be changed once set.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_birthday_change ON public.user_private;
CREATE TRIGGER trg_prevent_birthday_change
  BEFORE UPDATE ON public.user_private
  FOR EACH ROW EXECUTE FUNCTION public.prevent_birthday_change();

-- ── 5. Public profile reader (the only door for other users) ───────────────
-- SECURITY DEFINER so it can read user_private past RLS, but it returns each
-- private field ONLY when that field's flag is true.
CREATE OR REPLACE FUNCTION public.get_public_profile(target uuid)
RETURNS TABLE (
  id           uuid,
  username     text,
  display_name text,
  bio          text,
  avatar_url   text,
  phone        text,
  birthday     date,
  gender       text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.username,
    u.display_name,
    u.bio,
    u.avatar_url,
    CASE WHEN p.phone_public  THEN p.phone    END,
    CASE WHEN p.dob_public    THEN p.birthday END,
    CASE WHEN p.gender_public THEN p.gender   END
  FROM public.users u
  LEFT JOIN public.user_private p ON p.user_id = u.id
  WHERE u.id = target;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;

-- ============================================================
-- Peolia Sprint 6e — Identifier availability RPCs
-- Run in Supabase Dashboard → SQL Editor (idempotent).
--
-- Used by the Sign Up screen's live availability check. SECURITY DEFINER so
-- they can read auth.users / the private table that clients can't query.
--
-- "Taken" means the identifier is used ANYWHERE (login email, recovery email,
-- or any stored phone) so each email/phone maps to exactly one account — which
-- is what makes the login-secondary fallback unambiguous.
-- Both return TRUE when the identifier is free.
-- ============================================================

-- ── Email availability ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_email_available(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM auth.users        WHERE lower(email)          = lower(p_email)
    UNION ALL
    SELECT 1 FROM public.user_private WHERE lower(recovery_email) = lower(p_email)
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_email_available(text) TO anon, authenticated;

-- ── Phone availability (compare digits-only to dodge formatting) ─────────────
CREATE OR REPLACE FUNCTION public.check_phone_available(p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_private
    WHERE regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
      AND regexp_replace(p_phone, '\D', '', 'g') <> ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_phone_available(text) TO anon, authenticated;

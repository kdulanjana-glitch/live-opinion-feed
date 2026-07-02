-- ============================================================
-- Peolia — Sprint 8: Direct Messaging + Wave Preferences
-- Run in Supabase Dashboard → SQL Editor.
--
-- This reproduces, in one place, the schema that was applied manually during
-- the sprint (DM tables/RLS/trigger/RPCs/storage, the dm_conversation_prefs
-- table, wave_preferences, and the user_wave_stats.score column + triggers).
--
-- Idempotent: safe to re-run on a FRESH database. The PRODUCTION database
-- already has all of this — treat production as the source of truth. The only
-- piece that can DOUBLE UP on a DB that already has it is the wave-score
-- triggers in Section A (they were authored out-of-band, so their live names
-- may differ from the ones below). Do NOT run Section A against production
-- unless you have verified it doesn't already have equivalent triggers.
-- ============================================================


-- ============================================================
-- SECTION A — Wave preferences + behavioral DNA score
-- ============================================================

-- Per-citizen, per-wave feed/DNA preferences (Settings → Personalize).
CREATE TABLE IF NOT EXISTS public.wave_preferences (
  user_id      UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wave         TEXT    NOT NULL,
  level        TEXT    NOT NULL DEFAULT 'high' CHECK (level IN ('low','mid','high')),
  excluded     BOOLEAN NOT NULL DEFAULT false,
  dna_include  BOOLEAN NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, wave)     -- supports upsert onConflict 'user_id,wave'
);

ALTER TABLE public.wave_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_prefs_all_own ON public.wave_preferences;
CREATE POLICY wave_prefs_all_own ON public.wave_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Behavioral DNA score (reacts + floats). Drives the Profile radar.
ALTER TABLE public.user_wave_stats
  ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;

-- Reacting to a senti → +20 to the reactor's score for that senti's wave.
-- (initcap normalises wave casing to match user_wave_stats, e.g. 'tech'→'Tech'.)
CREATE OR REPLACE FUNCTION public.bump_wave_score_on_react()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wave TEXT;
BEGIN
  SELECT initcap(wave) INTO v_wave FROM public.sentis WHERE id = NEW.senti_id;
  IF v_wave IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.user_wave_stats (user_id, wave, score)
       VALUES (NEW.user_id, v_wave, 20)
  ON CONFLICT (user_id, wave)
  DO UPDATE SET score = public.user_wave_stats.score + 20;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_react_bump_wave_score ON public.senti_reactions;
CREATE TRIGGER on_react_bump_wave_score
  AFTER INSERT ON public.senti_reactions
  FOR EACH ROW EXECUTE FUNCTION public.bump_wave_score_on_react();

-- Floating a senti → +80 to the author's score for that wave.
CREATE OR REPLACE FUNCTION public.bump_wave_score_on_float()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wave TEXT;
BEGIN
  v_wave := initcap(NEW.wave);
  IF v_wave IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.user_wave_stats (user_id, wave, score)
       VALUES (NEW.user_id, v_wave, 80)
  ON CONFLICT (user_id, wave)
  DO UPDATE SET score = public.user_wave_stats.score + 80;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_float_bump_wave_score ON public.sentis;
CREATE TRIGGER on_float_bump_wave_score
  AFTER INSERT ON public.sentis
  FOR EACH ROW EXECUTE FUNCTION public.bump_wave_score_on_float();


-- ============================================================
-- SECTION B — Direct messaging tables
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_id  UUID,                            -- no FK (circular); kept in sync by trigger
  last_message_at  TIMESTAMPTZ,
  unread_p1        SMALLINT NOT NULL DEFAULT 0 CHECK (unread_p1 >= 0),
  unread_p2        SMALLINT NOT NULL DEFAULT 0 CHECK (unread_p2 >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_participants_ordered CHECK (participant_1_id < participant_2_id),
  CONSTRAINT unique_conversation      UNIQUE (participant_1_id, participant_2_id)
);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.users(id)            ON DELETE CASCADE,
  body            TEXT,
  image_path      TEXT,                             -- storage PATH only; signed URL client-side
  senti_id        UUID REFERENCES public.sentis(id) ON DELETE SET NULL, -- shared senti
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  hidden_from     UUID[]  NOT NULL DEFAULT '{}',    -- delete-for-me
  deleted_for_all BOOLEAN NOT NULL DEFAULT false,   -- delete-for-everyone
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- senti_id for DBs created before senti-sharing was added.
ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS senti_id UUID REFERENCES public.sentis(id) ON DELETE SET NULL;

-- Content check: a message must carry text, an image, OR a shared senti.
ALTER TABLE public.dm_messages DROP CONSTRAINT IF EXISTS chk_has_content;
ALTER TABLE public.dm_messages ADD CONSTRAINT chk_has_content
  CHECK (body IS NOT NULL OR image_path IS NOT NULL OR senti_id IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.dm_message_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_reaction UNIQUE (message_id, user_id)
);

-- Per-citizen conversation prefs (pin / archive / mute).
CREATE TABLE IF NOT EXISTS public.dm_conversation_prefs (
  user_id         UUID NOT NULL REFERENCES public.users(id)            ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  pinned          BOOLEAN NOT NULL DEFAULT false,
  archived        BOOLEAN NOT NULL DEFAULT false,
  muted_until     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);


-- ============================================================
-- SECTION C — Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_dm_conv_p1       ON public.dm_conversations(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_dm_conv_p2       ON public.dm_conversations(participant_2_id);
CREATE INDEX IF NOT EXISTS idx_dm_conv_time     ON public.dm_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_dm_msg_conv      ON public.dm_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dm_msg_reactions ON public.dm_message_reactions(message_id);


-- ============================================================
-- SECTION D — Row level security
-- ============================================================

ALTER TABLE public.dm_conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_message_reactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_conversation_prefs ENABLE ROW LEVEL SECURITY;

-- dm_conversations
DROP POLICY IF EXISTS conv_select ON public.dm_conversations;
CREATE POLICY conv_select ON public.dm_conversations FOR SELECT
  USING (participant_1_id = auth.uid() OR participant_2_id = auth.uid());

-- Block check helper — SECURITY DEFINER because user_blocks RLS only shows a
-- user their own blocks; the "they blocked me" direction needs elevated read.
CREATE OR REPLACE FUNCTION public.dm_pair_blocked(a UUID, b UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;
GRANT EXECUTE ON FUNCTION public.dm_pair_blocked(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS conv_insert ON public.dm_conversations;
CREATE POLICY conv_insert ON public.dm_conversations FOR INSERT
  WITH CHECK (
    (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
    AND participant_1_id < participant_2_id
    AND NOT public.dm_pair_blocked(participant_1_id, participant_2_id)
  );

DROP POLICY IF EXISTS conv_update ON public.dm_conversations;
CREATE POLICY conv_update ON public.dm_conversations FOR UPDATE
  USING (participant_1_id = auth.uid() OR participant_2_id = auth.uid());

-- dm_messages  (hidden_from filter = delete-for-me invisible at DB level)
DROP POLICY IF EXISTS msg_select ON public.dm_messages;
CREATE POLICY msg_select ON public.dm_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.dm_conversations
      WHERE participant_1_id = auth.uid() OR participant_2_id = auth.uid()
    )
    AND NOT (auth.uid() = ANY(hidden_from))
  );

DROP POLICY IF EXISTS msg_insert ON public.dm_messages;
CREATE POLICY msg_insert ON public.dm_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT c.id FROM public.dm_conversations c
      WHERE (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
        AND NOT public.dm_pair_blocked(c.participant_1_id, c.participant_2_id)
    )
  );

-- NOTE: this USING-only UPDATE policy rejects direct client writes in practice;
-- the app mutates dm_messages through the SECURITY DEFINER RPCs in Section F.
DROP POLICY IF EXISTS msg_update ON public.dm_messages;
CREATE POLICY msg_update ON public.dm_messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM public.dm_conversations
      WHERE participant_1_id = auth.uid() OR participant_2_id = auth.uid()
    )
  );

-- dm_message_reactions
DROP POLICY IF EXISTS reaction_select ON public.dm_message_reactions;
CREATE POLICY reaction_select ON public.dm_message_reactions FOR SELECT
  USING (
    message_id IN (
      SELECT m.id FROM public.dm_messages m
      JOIN public.dm_conversations c ON c.id = m.conversation_id
      WHERE c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS reaction_insert ON public.dm_message_reactions;
CREATE POLICY reaction_insert ON public.dm_message_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS reaction_update ON public.dm_message_reactions;
CREATE POLICY reaction_update ON public.dm_message_reactions FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS reaction_delete ON public.dm_message_reactions;
CREATE POLICY reaction_delete ON public.dm_message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- dm_conversation_prefs (column-only check → client upsert works directly)
DROP POLICY IF EXISTS dmprefs_all_own ON public.dm_conversation_prefs;
CREATE POLICY dmprefs_all_own ON public.dm_conversation_prefs
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ============================================================
-- SECTION E — New-message trigger (bumps last_message + unread)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_dm_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p1 UUID; v_p2 UUID;
BEGIN
  SELECT participant_1_id, participant_2_id INTO v_p1, v_p2
    FROM public.dm_conversations WHERE id = NEW.conversation_id;

  UPDATE public.dm_conversations SET
    last_message_id = NEW.id,
    last_message_at = NEW.created_at,
    unread_p1 = CASE WHEN NEW.sender_id = v_p2 THEN LEAST(unread_p1 + 1, 999) ELSE unread_p1 END,
    unread_p2 = CASE WHEN NEW.sender_id = v_p1 THEN LEAST(unread_p2 + 1, 999) ELSE unread_p2 END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_dm_message_insert ON public.dm_messages;
CREATE TRIGGER on_dm_message_insert
  AFTER INSERT ON public.dm_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_dm_message();


-- ============================================================
-- SECTION F — Message mutation RPCs (SECURITY DEFINER)
-- The USING-only UPDATE policies reject direct client writes (42501); these
-- enforce membership themselves and are the only write path the app uses.
-- ============================================================

CREATE OR REPLACE FUNCTION public.dm_hide_message(p_message_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.dm_messages m
     SET hidden_from = array_append(m.hidden_from, auth.uid())
   WHERE m.id = p_message_id
     AND NOT (auth.uid() = ANY(m.hidden_from))
     AND EXISTS (
       SELECT 1 FROM public.dm_conversations c
        WHERE c.id = m.conversation_id
          AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
     );
END; $$;

CREATE OR REPLACE FUNCTION public.dm_delete_message_for_all(p_message_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.dm_messages m
     SET deleted_for_all = true
   WHERE m.id = p_message_id
     AND m.sender_id = auth.uid();
END; $$;

CREATE OR REPLACE FUNCTION public.dm_mark_conversation_read(p_conversation_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p1 UUID; v_p2 UUID;
BEGIN
  SELECT participant_1_id, participant_2_id INTO v_p1, v_p2
    FROM public.dm_conversations WHERE id = p_conversation_id;
  IF auth.uid() IS NULL OR auth.uid() NOT IN (v_p1, v_p2) THEN RETURN; END IF;

  UPDATE public.dm_messages
     SET is_read = true, read_at = now()
   WHERE conversation_id = p_conversation_id
     AND sender_id <> auth.uid()
     AND is_read = false;

  UPDATE public.dm_conversations
     SET unread_p1 = CASE WHEN auth.uid() = participant_1_id THEN 0 ELSE unread_p1 END,
         unread_p2 = CASE WHEN auth.uid() = participant_2_id THEN 0 ELSE unread_p2 END
   WHERE id = p_conversation_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.dm_hide_message(UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.dm_delete_message_for_all(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.dm_mark_conversation_read(UUID)  TO authenticated;


-- ============================================================
-- SECTION G — Realtime (idempotent publication adds)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dm_conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_conversations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dm_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dm_message_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_message_reactions;
  END IF;
END $$;


-- ============================================================
-- SECTION H — Storage bucket (private; signed URLs)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dm-media', 'dm-media', false, 10485760,
        ARRAY['image/jpeg','image/jpg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "dm_media_upload" ON storage.objects;
CREATE POLICY "dm_media_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dm-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dm_media_select" ON storage.objects;
CREATE POLICY "dm_media_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'dm-media' AND auth.role() = 'authenticated');


-- Refresh PostgREST's schema cache so new tables/RPCs resolve immediately.
NOTIFY pgrst, 'reload schema';

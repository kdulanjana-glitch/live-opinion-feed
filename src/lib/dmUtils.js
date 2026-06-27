// ─────────────────────────────────────────────
// Peolia — DM utilities
// src/lib/dmUtils.js
//
// Pure-ish helpers for the DM feature. The supabase client is always passed in
// (these never import it) so they stay easy to reason about and test.
//
// Participant ordering: dm_conversations enforces participant_1_id < participant_2_id
// via CHECK. ALWAYS sort the pair before any lookup/insert.
// ─────────────────────────────────────────────

// Find or create the 1:1 conversation between two citizens → returns conversationId.
export async function getOrCreateDMConversation(supabase, currentUserId, otherUserId) {
  const [p1, p2] = [currentUserId, otherUserId].sort();   // string sort → p1 < p2

  const { data, error } = await supabase
    .from('dm_conversations')
    .select('id')
    .eq('participant_1_id', p1)
    .eq('participant_2_id', p2)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.id;

  const { data: created, error: insErr } = await supabase
    .from('dm_conversations')
    .insert({ participant_1_id: p1, participant_2_id: p2 })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return created.id;
}

// Mark the OTHER party's messages read + zero my unread counter on the conversation.
// Routed through a SECURITY DEFINER RPC — the USING-only RLS UPDATE policies reject
// direct client writes (42501). currentUserId/isParticipant1 kept for call compat.
export async function markConversationRead(supabase, conversationId, currentUserId, isParticipant1) {   // eslint-disable-line no-unused-vars
  if (!conversationId) return;
  const { error } = await supabase.rpc('dm_mark_conversation_read', { p_conversation_id: conversationId });
  if (error) console.error('markConversationRead error', error);
}

// My unread count for a conversation row (which column depends on which participant I am).
export function getMyUnreadCount(conversation, currentUserId) {
  if (!conversation) return 0;
  return conversation.participant_1_id === currentUserId
    ? (conversation.unread_p1 ?? 0)
    : (conversation.unread_p2 ?? 0);
}

// One-line preview for the conversation list.
// (currentUserId kept in the signature for future "You: ..." prefixing.)
export function getLastMessagePreview(lastMsg, currentUserId) {   // eslint-disable-line no-unused-vars
  if (!lastMsg) return '';
  if (lastMsg.deleted_for_all) return 'Message deleted';
  if (lastMsg.image_path && !lastMsg.body) return '📷 Photo';
  const body = lastMsg.body ?? '';
  return body.length > 40 ? `${body.slice(0, 40)}...` : body;
}

// dm_messages.image_path is a PRIVATE storage path — never a public URL.
// Generate a 1-hour signed URL for display.
export async function generateDMSignedUrl(supabase, imagePath) {
  if (!imagePath) return null;
  const { data, error } = await supabase.storage
    .from('dm-media')
    .createSignedUrl(imagePath, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// Share a senti into a conversation (renders as a tappable senti card in the thread).
// Requires the dm_messages.senti_id column + relaxed chk_has_content (see migration).
export async function sendSentiToDM(supabase, conversationId, senderId, sentiId) {
  const { error } = await supabase.from('dm_messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    senti_id: sentiId,
  });
  if (error) throw error;
}

// ── Per-conversation prefs (pin / archive / mute) — dm_conversation_prefs table ──
export const MUTE_OPTIONS = {
  day:    () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  week:   () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  always: () => new Date('2999-01-01T00:00:00Z').toISOString(),
};

export function isMuted(pref) {
  if (!pref?.muted_until) return false;
  return new Date(pref.muted_until).getTime() > Date.now();
}

// Upsert a partial pref change for one conversation (optimistic callers handle UI).
export async function setConversationPref(supabase, userId, conversationId, changes) {
  if (!userId || !conversationId) return;
  const { error } = await supabase
    .from('dm_conversation_prefs')
    .upsert(
      { user_id: userId, conversation_id: conversationId, ...changes, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,conversation_id' },
    );
  if (error) throw error;
}

// Fetch one conversation's pref row (or null).
export async function getConversationPref(supabase, userId, conversationId) {
  if (!userId || !conversationId) return null;
  const { data } = await supabase
    .from('dm_conversation_prefs')
    .select('pinned, archived, muted_until')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .maybeSingle();
  return data ?? null;
}

// Initials for a DM avatar. avatar_initials is stale ('??') for many rows — skip it
// and derive from display_name, then username.
export function dmInitials(user) {
  const ai = user?.avatar_initials;
  if (ai && ai !== '??') return ai;
  const base = (user?.display_name?.trim() || user?.username || '?');
  return base.charAt(0).toUpperCase();
}

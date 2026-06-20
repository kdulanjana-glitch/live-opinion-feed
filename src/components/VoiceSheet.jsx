// ─────────────────────────────────────────────
// Peolia — VoiceSheet
// src/components/VoiceSheet.jsx
//
// Bottom sheet for voices (comments) on a senti. Supports:
//   • New / Top sort
//   • Per-voice likes (voice_likes)
//   • One level of threaded replies (voices.parent_id)
//   • Avatar photos (users.avatar_url) with initials fallback
//   • Optimistic posting — new voice appears instantly, no list reload
//
// Tables: public.voices (id, senti_id, user_id, body, parent_id, like_count,
//         is_pinned, created_at) joined with users(username, display_name,
//         avatar_initials, avatar_url); public.voice_likes (voice_id, user_id)
// ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Icon from './Icon';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s, SCREEN_HEIGHT } from '../utils/peoliaScale';

const MAX_LEN = 300;

// avatar_initials is stale ('??') for legacy rows — fall back to a derived letter.
const initialsOf = (u) => {
  const ai = u?.avatar_initials;
  if (ai && ai !== '??') return ai.toUpperCase();
  return (u?.display_name?.[0] ?? u?.username?.[0] ?? '?').toUpperCase();
};

const primaryName = (u) =>
  (u?.display_name && u.display_name.trim()) ? u.display_name : `@${u?.username ?? 'citizen'}`;

// Compact relative timestamp.
const relTime = (dateStr) => {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return `${Math.floor(diffDay / 7)}w`;
};

export default function VoiceSheet({ visible, onClose, sentiId, session, onVoicePosted }) {
  const scheme = usePeoliaScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();

  const [voices,     setVoices]     = useState([]);   // flat list of all rows
  const [text,       setText]       = useState('');
  const [loading,    setLoading]    = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [sortMode,   setSortMode]   = useState('new');           // 'new' | 'top'
  const [replyingTo, setReplyingTo] = useState(null);            // { id, displayName }
  const [voiceLikes, setVoiceLikes] = useState(new Set());       // liked voice ids
  const [meProfile,  setMeProfile]  = useState(null);            // my user row for optimistic rows
  const [expanded,   setExpanded]   = useState(new Set());       // parent ids with all replies shown

  const myId = session?.user?.id ?? null;

  useEffect(() => {
    if (visible && sentiId) fetchVoices();
    if (visible && myId)    fetchMe();
    if (!visible) { setText(''); setReplyingTo(null); setExpanded(new Set()); }
  }, [visible, sentiId]);

  // My own profile — used to render the optimistic row before the DB round-trip.
  const fetchMe = async () => {
    const { data } = await supabase
      .from('users')
      .select('username, display_name, avatar_initials, avatar_url')
      .eq('id', myId)
      .single();
    setMeProfile(data ?? null);
  };

  // Re-fetch when the sort changes (only while open).
  useEffect(() => {
    if (visible && sentiId) fetchVoices();
  }, [sortMode]);

  const fetchVoices = async () => {
    setLoading(true);

    // Step 1 — all voices for this senti
    const { data: voicesData } = await supabase
      .from('voices')
      .select('id, body, created_at, parent_id, like_count, is_pinned, users(username, display_name, avatar_initials, avatar_url)')
      .eq('senti_id', sentiId)
      .order('is_pinned', { ascending: false })
      .order(sortMode === 'top' ? 'like_count' : 'created_at', { ascending: false })
      .limit(100);
    const rows = voicesData ?? [];
    setVoices(rows);

    // Step 2 — which of these have I liked?
    if (myId && rows.length) {
      const { data: likeData } = await supabase
        .from('voice_likes')
        .select('voice_id')
        .eq('user_id', myId)
        .in('voice_id', rows.map((v) => v.id));
      setVoiceLikes(new Set(likeData?.map((l) => l.voice_id) ?? []));
    } else {
      setVoiceLikes(new Set());
    }

    setLoading(false);
  };

  // Group flat rows into top-level + replies map (replies oldest-first).
  const topLevel = voices.filter((v) => !v.parent_id);
  const repliesMap = voices.reduce((acc, v) => {
    if (v.parent_id) (acc[v.parent_id] ??= []).push(v);
    return acc;
  }, {});
  Object.values(repliesMap).forEach((list) =>
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  );

  const handleLikeVoice = async (voiceId) => {
    if (!myId) return;
    const wasLiked = voiceLikes.has(voiceId);

    // Optimistic
    setVoiceLikes((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(voiceId) : next.add(voiceId);
      return next;
    });
    setVoices((prev) => prev.map((v) =>
      v.id === voiceId ? { ...v, like_count: (v.like_count ?? 0) + (wasLiked ? -1 : 1) } : v
    ));

    const { error } = wasLiked
      ? await supabase.from('voice_likes').delete().eq('voice_id', voiceId).eq('user_id', myId)
      : await supabase.from('voice_likes').insert({ voice_id: voiceId, user_id: myId });

    if (error) {
      // Rollback
      setVoiceLikes((prev) => {
        const next = new Set(prev);
        wasLiked ? next.add(voiceId) : next.delete(voiceId);
        return next;
      });
      setVoices((prev) => prev.map((v) =>
        v.id === voiceId ? { ...v, like_count: (v.like_count ?? 0) + (wasLiked ? 1 : -1) } : v
      ));
    }
  };

  const handleReply = (voiceId, actor) => {
    setReplyingTo({ id: voiceId, displayName: primaryName(actor) });
  };

  // Optimistic post — the new voice appears immediately; the DB write happens
  // in the background. No fetchVoices() → the list never flashes/reloads.
  const handleSubmit = async () => {
    if (!text.trim() || !myId || submitting) return;
    setSubmitting(true);

    const body       = text.trim();
    const parentId   = replyingTo?.id ?? null;
    const prevReply  = replyingTo;
    const tempId     = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      body,
      created_at: new Date().toISOString(),
      parent_id:  parentId,
      like_count: 0,
      is_pinned:  false,
      users: meProfile ?? { username: '', display_name: '', avatar_initials: '', avatar_url: null },
    };

    // Show it now; clear the composer
    setVoices((prev) => [optimistic, ...prev]);
    if (parentId) setExpanded((prev) => new Set(prev).add(parentId)); // reveal own reply
    setText('');
    setReplyingTo(null);
    onVoicePosted?.();   // bump the senti's voice count optimistically

    const { data, error } = await supabase
      .from('voices')
      .insert({ senti_id: sentiId, user_id: myId, body, parent_id: parentId })
      .select('id, body, created_at, parent_id, like_count, is_pinned')
      .single();

    if (error || !data) {
      // Rollback — pull the optimistic row, restore the composer
      setVoices((prev) => prev.filter((v) => v.id !== tempId));
      setText(body);
      setReplyingTo(prevReply);
    } else {
      // Swap the temp row for the real one (keep my joined profile for rendering)
      setVoices((prev) => prev.map((v) =>
        v.id === tempId ? { ...data, users: optimistic.users } : v
      ));
    }
    setSubmitting(false);
  };

  // ── Renderers ──
  const renderActor = (v, { isReply } = {}) => {
    const u = v.users;
    const hasDisplay = !!(u?.display_name && u.display_name.trim());
    return (
      <View style={[st.row, isReply && st.replyRow]}>
        <View style={[st.avatar, isReply && st.avatarSmall, { backgroundColor: C.accentLight, borderColor: C.accentMid }]}>
          {u?.avatar_url ? (
            <Image source={{ uri: u.avatar_url }} style={[st.avatarImg, isReply && st.avatarImgSmall]} resizeMode="cover" />
          ) : (
            <Text style={[st.avatarText, isReply && st.avatarTextSmall, { color: C.accent }]}>
              {initialsOf(u)}
            </Text>
          )}
        </View>
        <View style={st.rowBody}>
          {v.is_pinned && !isReply && (
            <View style={st.pinnedPill}>
              <Icon name="ti-pin" size={fs(9)} color="#FFFFFF" />
              <Text style={st.pinnedPillText}>Pinned</Text>
            </View>
          )}
          <View style={st.nameRow}>
            <Text style={st.displayName} numberOfLines={1}>{primaryName(u)}</Text>
            <Text style={st.time}>{relTime(v.created_at)}</Text>
          </View>
          {hasDisplay && <Text style={st.handle2}>@{u.username}</Text>}
          <Text style={st.voiceText}>{v.body}</Text>

          <View style={st.actionRow}>
            {!isReply && (
              <TouchableOpacity onPress={() => handleReply(v.id, u)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                <Text style={st.replyBtn}>Reply</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={st.likeBtn}
              onPress={() => handleLikeVoice(v.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Icon
                name="ti-heart"
                size={fs(14)}
                color={voiceLikes.has(v.id) ? C.likeColor : C.iconMuted}
                style={voiceLikes.has(v.id) ? st.heartFilled : undefined}
              />
              {(v.like_count ?? 0) > 0 && <Text style={st.likeCount}>{v.like_count}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderVoice = (v) => {
    const replies = repliesMap[v.id] ?? [];
    const isExpanded = expanded.has(v.id);
    const shown = isExpanded ? replies : replies.slice(0, 3);
    return (
      <View key={v.id} style={st.voiceBlock}>
        {renderActor(v)}
        {shown.length > 0 && (
          <View style={st.repliesWrap}>
            {shown.map((r) => <View key={r.id}>{renderActor(r, { isReply: true })}</View>)}
            {replies.length > 3 && !isExpanded && (
              <TouchableOpacity
                onPress={() => setExpanded((prev) => new Set(prev).add(v.id))}
                activeOpacity={0.7}
              >
                <Text style={st.showMore}>Show {replies.length - 3} more {replies.length - 3 === 1 ? 'reply' : 'replies'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* behavior="padding" (NOT "height", which is janky on Android) + no
          statusBarTranslucent so KAV's keyboard frame math is correct. This
          lifts the bottom-anchored composer above the keyboard. */}
      <KeyboardAvoidingView style={st.overlay} behavior="padding">
          <View style={[
            st.sheet,
            {
              backgroundColor: C.sheetBg,
              borderColor: C.sheetBorder,
              paddingBottom: vs(20) + insets.bottom,
            },
          ]}>

            {/* Handle */}
            <View style={[st.handle, { backgroundColor: C.border }]} />

            {/* Header */}
            <View style={st.header}>
              <Text style={[st.title, { color: C.textPrimary }]}>Voices</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[st.closeBtn, { color: C.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Sort toggle */}
            {!loading && (
              <View style={st.sortRow}>
                {['new', 'top'].map((m) => {
                  const active = sortMode === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[st.sortPill, active ? st.sortPillActive : st.sortPillInactive]}
                      onPress={() => setSortMode(m)}
                      activeOpacity={0.8}
                    >
                      <Text style={[st.sortText, active ? st.sortTextActive : st.sortTextInactive]}>
                        {m === 'new' ? 'New' : 'Top'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* List */}
            {loading ? (
              <ActivityIndicator color={C.accent} style={{ marginVertical: vs(24) }} />
            ) : topLevel.length === 0 ? (
              <Text style={[st.empty, { color: C.textMuted }]}>
                No voices yet. Be the first to speak up.
              </Text>
            ) : (
              <ScrollView
                style={st.list}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {topLevel.map(renderVoice)}
              </ScrollView>
            )}

            {/* Replying-to strip */}
            {replyingTo && (
              <View style={st.replyStrip}>
                <Text style={st.replyStripText} numberOfLines={1}>
                  Replying to {replyingTo.displayName}
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="ti-x" size={fs(14)} color={C.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            {/* Input row */}
            <View style={[st.inputRow, { borderTopColor: C.border }]}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[st.input, { backgroundColor: C.surfaceAlt, borderColor: C.border, color: C.textPrimary }]}
                  placeholder="Add your voice..."
                  placeholderTextColor={C.textMuted}
                  value={text}
                  onChangeText={setText}
                  maxLength={MAX_LEN}
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                />
                {text.length > 240 && (
                  <Text style={st.counter}>{text.length}/{MAX_LEN}</Text>
                )}
              </View>
              <TouchableOpacity
                style={[st.sendBtn, { backgroundColor: text.trim() ? C.accent : C.surfaceAlt }]}
                onPress={handleSubmit}
                disabled={submitting || !text.trim()}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: text.trim() ? '#FFFFFF' : C.textMuted, fontSize: fs(18) }}>↑</Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%', borderTopLeftRadius: ms(20), borderTopRightRadius: ms(20),
    borderTopWidth: 0.5, paddingHorizontal: ms(16), maxHeight: SCREEN_HEIGHT * 0.78,
  },
  handle: { width: ms(36), height: vs(4), borderRadius: ms(2), alignSelf: 'center', marginTop: vs(10), marginBottom: vs(14) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(12) },
  title:    { fontSize: fs(17), fontWeight: '700' },
  closeBtn: { fontSize: fs(18), padding: ms(4) },

  // Sort toggle
  sortRow:  { flexDirection: 'row', gap: ms(8), marginBottom: vs(12) },
  sortPill: { paddingVertical: vs(6), paddingHorizontal: ms(16), borderRadius: ms(20) },
  sortPillActive:   { backgroundColor: C.accent },
  sortPillInactive: { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border },
  sortText:         { fontSize: fs(12), fontWeight: '700' },
  sortTextActive:   { color: '#FFFFFF' },
  sortTextInactive: { color: C.textMuted },

  empty: { textAlign: 'center', fontSize: fs(14), paddingVertical: vs(24) },
  list:  { maxHeight: SCREEN_HEIGHT * 0.46 },

  voiceBlock: { marginBottom: vs(14) },
  row:        { flexDirection: 'row', gap: ms(10), alignItems: 'flex-start' },
  replyRow:   { marginTop: vs(10) },
  avatar: {
    width: s(34), height: s(34), borderRadius: s(17), borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
  },
  avatarSmall:     { width: s(26), height: s(26), borderRadius: s(13) },
  avatarImg:       { width: s(34), height: s(34), borderRadius: s(17) },
  avatarImgSmall:  { width: s(26), height: s(26), borderRadius: s(13) },
  avatarText:      { fontSize: fs(13), fontWeight: '700' },
  avatarTextSmall: { fontSize: fs(11), fontWeight: '700' },
  rowBody:   { flex: 1 },

  pinnedPill: {
    flexDirection: 'row', alignItems: 'center', gap: ms(3), alignSelf: 'flex-start',
    backgroundColor: C.accent, borderRadius: ms(10), paddingVertical: vs(2), paddingHorizontal: ms(7),
    marginBottom: vs(4),
  },
  pinnedPillText: { fontSize: fs(9), fontWeight: '800', color: '#FFFFFF' },

  nameRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ms(8) },
  displayName: { flex: 1, fontSize: fs(13), fontWeight: '800', color: C.textPrimary },
  time:        { fontSize: fs(10), color: C.textMuted },
  handle2:     { fontSize: fs(11), color: C.textMuted, marginTop: vs(1) },
  voiceText:   { fontSize: fs(14), lineHeight: fs(20), color: C.textPrimary, marginTop: vs(3) },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12), marginTop: vs(6) },
  replyBtn:  { fontSize: fs(12), fontWeight: '700', color: C.textMuted },
  likeBtn:   { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  heartFilled: {},   // Feather heart is outline; color conveys liked state
  likeCount: { fontSize: fs(12), fontWeight: '600', color: C.textMuted },

  repliesWrap: { marginLeft: ms(34), marginTop: vs(2) },
  showMore:    { fontSize: fs(12), fontWeight: '700', color: C.accent, marginTop: vs(8) },

  replyStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surfaceAlt, borderRadius: ms(10),
    paddingVertical: vs(7), paddingHorizontal: ms(12), marginBottom: vs(8),
  },
  replyStripText: { flex: 1, fontSize: fs(12), color: C.textMuted, marginRight: ms(8) },

  inputRow: { flexDirection: 'row', gap: ms(10), borderTopWidth: 0.5, paddingTop: vs(12), marginTop: vs(8), alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: ms(22), paddingHorizontal: ms(16), paddingVertical: vs(10), fontSize: fs(14) },
  counter: { position: 'absolute', right: ms(14), bottom: vs(-14), fontSize: fs(9), color: C.textMuted },
  sendBtn: { width: s(42), height: s(42), borderRadius: s(21), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

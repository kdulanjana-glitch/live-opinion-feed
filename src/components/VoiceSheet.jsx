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

import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useBlocks } from '../context/BlockContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Icon from './Icon';

import { fs, ms, vs, s, SCREEN_HEIGHT } from '../utils/peoliaScale';

const MAX_LEN = 300;
const VOICE_PAGE = 50;   // voices per page (initial + load-more)

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
  const { hiddenIds } = useBlocks();

  const [voices,     setVoices]     = useState([]);   // flat list of all rows
  const [text,       setText]       = useState('');
  const [loading,    setLoading]    = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,    setHasMore]    = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Offset over rows fetched via fetch/loadMore ONLY (optimistic + realtime rows
  // are excluded so the DB offset doesn't drift).
  const fetchedCountRef = useRef(0);

  const [sortMode,   setSortMode]   = useState('new');           // 'new' | 'top'
  const [replyingTo, setReplyingTo] = useState(null);            // { id, displayName }
  const [voiceLikes,    setVoiceLikes]    = useState(new Set());  // liked voice ids
  const [voiceDislikes, setVoiceDislikes] = useState(new Set());  // disliked voice ids
  const [meProfile,  setMeProfile]  = useState(null);            // my user row for optimistic rows
  const [expanded,   setExpanded]   = useState(new Set());       // parent ids with all replies shown
  const [expandedCollapsed, setExpandedCollapsed] = useState(new Set()); // heavily-disliked ids manually revealed

  const myId = session?.user?.id ?? null;

  useEffect(() => {
    if (visible && sentiId) fetchVoices();
    if (visible && myId)    fetchMe();
    if (!visible) { setText(''); setReplyingTo(null); setExpanded(new Set()); setExpandedCollapsed(new Set()); }
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

  // ── Realtime: other citizens' new voices appear while the sheet is open ──
  // Own posts are skipped (already added optimistically); blocked authors skipped.
  useEffect(() => {
    if (!visible || !sentiId) return;
    const channel = supabase
      .channel(`voices-${sentiId}-${Date.now()}`)   // unique topic per open (avoids reuse-after-subscribe)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'voices', filter: `senti_id=eq.${sentiId}` },
        async (payload) => {
          const row = payload.new;
          if (!row || row.user_id === myId) return;
          if (hiddenIds.includes(row.user_id)) return;
          // Payload has no join — fetch the author's profile for rendering.
          const { data: u } = await supabase
            .from('users')
            .select('username, display_name, avatar_initials, avatar_url')
            .eq('id', row.user_id)
            .maybeSingle();
          setVoices((prev) => prev.some((v) => v.id === row.id)
            ? prev
            : [{ ...row, users: u ?? null }, ...prev]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sentiId]);

  // ── Delete own voice (confirm → optimistic remove incl. replies → DB) ──
  const handleDeleteVoice = (voice) => {
    if (!myId || voice.user_id !== myId) return;
    Alert.alert(
      'Delete this voice?',
      voice.parent_id ? 'This removes your reply.' : 'This removes your voice and any replies to it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const prev = voices;
            setVoices((cur) => cur.filter((v) => v.id !== voice.id && v.parent_id !== voice.id));
            const { error } = await supabase
              .from('voices')
              .delete()
              .eq('id', voice.id)
              .eq('user_id', myId);
            if (error) {
              console.error('handleDeleteVoice error', error);
              setVoices(prev);
              Alert.alert('Could not delete', 'Please try again.');
            } else {
              onVoicePosted?.();   // re-syncs the senti's voice count from senti_counts
            }
          },
        },
      ],
    );
  };

  // One page of voices from the given offset (blocked authors filtered out;
  // replies left orphaned under an unloaded/removed parent simply don't render).
  const fetchVoicePage = async (offset) => {
    let query = supabase
      .from('voices')
      .select('id, user_id, body, created_at, parent_id, like_count, dislike_count, net_score, is_pinned, users(username, display_name, avatar_initials, avatar_url)')
      .eq('senti_id', sentiId)
      .order('is_pinned', { ascending: false })
      .order(sortMode === 'top' ? 'net_score' : 'created_at', { ascending: false })
      .range(offset, offset + VOICE_PAGE - 1);
    if (hiddenIds.length) {
      query = query.not('user_id', 'in', `(${hiddenIds.map((id) => `"${id}"`).join(',')})`);
    }
    const { data } = await query;
    return data ?? [];
  };

  // My like/dislike state for a batch of voice ids — merged into the sets.
  const fetchMyStates = async (ids, { merge } = {}) => {
    if (!myId || !ids.length) {
      if (!merge) { setVoiceLikes(new Set()); setVoiceDislikes(new Set()); }
      return;
    }
    const [{ data: likeData }, { data: dislikeData }] = await Promise.all([
      supabase.from('voice_likes').select('voice_id').eq('user_id', myId).in('voice_id', ids),
      supabase.from('voice_dislikes').select('voice_id').eq('user_id', myId).in('voice_id', ids),
    ]);
    const likes    = likeData?.map((l) => l.voice_id) ?? [];
    const dislikes = dislikeData?.map((d) => d.voice_id) ?? [];
    setVoiceLikes((prev) => new Set(merge ? [...prev, ...likes] : likes));
    setVoiceDislikes((prev) => new Set(merge ? [...prev, ...dislikes] : dislikes));
  };

  const fetchVoices = async () => {
    setLoading(true);
    const rows = await fetchVoicePage(0);
    fetchedCountRef.current = rows.length;
    setHasMore(rows.length === VOICE_PAGE);
    setVoices(rows);
    await fetchMyStates(rows.map((v) => v.id));
    setLoading(false);
  };

  // ── Load the next page (appended, deduped) ──
  const loadMoreVoices = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchVoicePage(fetchedCountRef.current);
      fetchedCountRef.current += rows.length;
      setHasMore(rows.length === VOICE_PAGE);
      setVoices((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...rows.filter((r) => !seen.has(r.id))];
      });
      await fetchMyStates(rows.map((v) => v.id), { merge: true });
    } catch (err) {
      console.error('loadMoreVoices error', err);
    } finally {
      setLoadingMore(false);
    }
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

  // Patch a single voice's counts in the flat `voices` list, keeping net_score
  // consistent. Shared by both the like and dislike handlers.
  const updateVoiceCountsLocally = (voiceId, { likeDelta = 0, dislikeDelta = 0 }) => {
    setVoices((prev) => prev.map((v) => {
      if (v.id !== voiceId) return v;
      const like_count    = (v.like_count ?? 0) + likeDelta;
      const dislike_count = (v.dislike_count ?? 0) + dislikeDelta;
      return { ...v, like_count, dislike_count, net_score: like_count - dislike_count };
    }));
  };

  const handleLikeVoice = async (voiceId) => {
    if (!myId) return;
    const wasLiked    = voiceLikes.has(voiceId);
    const wasDisliked = voiceDislikes.has(voiceId);

    // Optimistic — toggle like, clear any opposite dislike (mutual exclusivity)
    setVoiceLikes((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(voiceId) : next.add(voiceId);
      return next;
    });
    if (!wasLiked && wasDisliked) {
      setVoiceDislikes((prev) => {
        const next = new Set(prev);
        next.delete(voiceId);
        return next;
      });
    }
    updateVoiceCountsLocally(voiceId, {
      likeDelta:    wasLiked ? -1 : 1,
      dislikeDelta: (!wasLiked && wasDisliked) ? -1 : 0,
    });

    try {
      let error;
      if (wasLiked) {
        ({ error } = await supabase.from('voice_likes').delete().eq('voice_id', voiceId).eq('user_id', myId));
      } else {
        // DB trigger removes the opposite dislike row server-side if one existed.
        ({ error } = await supabase.from('voice_likes').insert({ voice_id: voiceId, user_id: myId }));
      }
      if (error) throw error;
    } catch (err) {
      console.error('handleLikeVoice error', err);
      fetchVoices(); // reliable rollback given the cross-table mutual-exclusivity side effect
    }
  };

  const handleDislikeVoice = async (voiceId) => {
    if (!myId) return;
    const wasDisliked = voiceDislikes.has(voiceId);
    const wasLiked    = voiceLikes.has(voiceId);

    // Optimistic — toggle dislike, clear any opposite like (mutual exclusivity)
    setVoiceDislikes((prev) => {
      const next = new Set(prev);
      wasDisliked ? next.delete(voiceId) : next.add(voiceId);
      return next;
    });
    if (!wasDisliked && wasLiked) {
      setVoiceLikes((prev) => {
        const next = new Set(prev);
        next.delete(voiceId);
        return next;
      });
    }
    updateVoiceCountsLocally(voiceId, {
      dislikeDelta: wasDisliked ? -1 : 1,
      likeDelta:    (!wasDisliked && wasLiked) ? -1 : 0,
    });

    try {
      let error;
      if (wasDisliked) {
        ({ error } = await supabase.from('voice_dislikes').delete().eq('voice_id', voiceId).eq('user_id', myId));
      } else {
        // DB trigger removes the opposite like row server-side if one existed.
        ({ error } = await supabase.from('voice_dislikes').insert({ voice_id: voiceId, user_id: myId }));
      }
      if (error) throw error;
    } catch (err) {
      console.error('handleDislikeVoice error', err);
      fetchVoices(); // reliable rollback given the cross-table mutual-exclusivity side effect
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
      user_id: myId,
      body,
      created_at: new Date().toISOString(),
      parent_id:  parentId,
      like_count: 0,
      dislike_count: 0,
      net_score:  0,
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
      .select('id, body, created_at, parent_id, like_count, dislike_count, net_score, is_pinned')
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

    // Heavily-disliked voices/replies collapse behind a tap-to-show placeholder.
    const isCollapsed = (v.net_score ?? 0) <= -5;
    if (isCollapsed && !expandedCollapsed.has(v.id)) {
      return (
        <TouchableOpacity
          onPress={() => setExpandedCollapsed((prev) => new Set(prev).add(v.id))}
          style={st.collapsedRow}
          activeOpacity={0.7}
        >
          <Text style={st.collapsedText}>
            This voice received a lot of dislikes — tap to show
          </Text>
        </TouchableOpacity>
      );
    }

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
            {/* Dislike — own filled/outline state only; never shows a count */}
            <TouchableOpacity
              style={st.dislikeBtn}
              onPress={() => handleDislikeVoice(v.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Icon
                name="ti-thumbs-down"
                size={fs(14)}
                color={voiceDislikes.has(v.id) ? C.nahText : C.iconMuted}
              />
            </TouchableOpacity>
            {/* Delete — own voices only */}
            {myId && v.user_id === myId && (
              <TouchableOpacity
                onPress={() => handleDeleteVoice(v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Icon name="ti-trash" size={fs(14)} color={C.iconMuted} />
              </TouchableOpacity>
            )}
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
                {hasMore && (
                  <TouchableOpacity style={st.loadMoreBtn} onPress={loadMoreVoices} disabled={loadingMore} activeOpacity={0.7}>
                    {loadingMore
                      ? <ActivityIndicator color={C.accent} size="small" />
                      : <Text style={st.loadMoreText}>Load more voices</Text>}
                  </TouchableOpacity>
                )}
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
  title:    { fontSize: fs(17), fontFamily: F.bold },
  closeBtn: { fontFamily: F.regular, fontSize: fs(18), padding: ms(4) },

  // Sort toggle
  sortRow:  { flexDirection: 'row', gap: ms(8), marginBottom: vs(12) },
  sortPill: { paddingVertical: vs(6), paddingHorizontal: ms(16), borderRadius: ms(20) },
  sortPillActive:   { backgroundColor: C.accent },
  sortPillInactive: { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border },
  sortText:         { fontSize: fs(12), fontFamily: F.bold },
  sortTextActive:   { color: '#FFFFFF' },
  sortTextInactive: { color: C.textMuted },

  empty: { fontFamily: F.regular, textAlign: 'center', fontSize: fs(14), paddingVertical: vs(24) },
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
  avatarText:      { fontSize: fs(13), fontFamily: F.bold },
  avatarTextSmall: { fontSize: fs(11), fontFamily: F.bold },
  rowBody:   { flex: 1 },

  pinnedPill: {
    flexDirection: 'row', alignItems: 'center', gap: ms(3), alignSelf: 'flex-start',
    backgroundColor: C.accent, borderRadius: ms(10), paddingVertical: vs(2), paddingHorizontal: ms(7),
    marginBottom: vs(4),
  },
  pinnedPillText: { fontSize: fs(9), fontFamily: F.extraBold, color: '#FFFFFF' },

  nameRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ms(8) },
  displayName: { letterSpacing: -0.2, flex: 1, fontSize: fs(13), fontFamily: F.extraBold, color: C.textPrimary },
  time:        { fontFamily: F.regular, fontSize: fs(10), color: C.textMuted },
  handle2:     { fontFamily: F.regular, fontSize: fs(11), color: C.textMuted, marginTop: vs(1) },
  voiceText:   { fontFamily: F.regular, fontSize: fs(14), lineHeight: fs(20), color: C.textPrimary, marginTop: vs(3) },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12), marginTop: vs(6) },
  replyBtn:  { fontSize: fs(12), fontFamily: F.bold, color: C.textMuted },
  likeBtn:   { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  dislikeBtn: { flexDirection: 'row', alignItems: 'center', gap: ms(3) },
  heartFilled: {},   // Feather heart is outline; color conveys liked state
  likeCount: { fontSize: fs(12), fontFamily: F.semiBold, color: C.textMuted },

  // Collapsed placeholder for heavily-disliked voices/replies
  collapsedRow: {
    paddingVertical: vs(8), paddingHorizontal: ms(10),
    backgroundColor: C.surfaceAlt, borderRadius: ms(10), marginBottom: vs(8),
  },
  collapsedText: { fontSize: fs(9), color: C.textMuted, fontFamily: F.semiBold },

  repliesWrap: { marginLeft: ms(34), marginTop: vs(2) },
  showMore:    { fontSize: fs(12), fontFamily: F.bold, color: C.accent, marginTop: vs(8) },
  loadMoreBtn: { alignItems: 'center', paddingVertical: vs(12) },
  loadMoreText: { fontSize: fs(13), fontFamily: F.bold, color: C.accent },

  replyStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surfaceAlt, borderRadius: ms(10),
    paddingVertical: vs(7), paddingHorizontal: ms(12), marginBottom: vs(8),
  },
  replyStripText: { fontFamily: F.regular, flex: 1, fontSize: fs(12), color: C.textMuted, marginRight: ms(8) },

  inputRow: { flexDirection: 'row', gap: ms(10), borderTopWidth: 0.5, paddingTop: vs(12), marginTop: vs(8), alignItems: 'center' },
  input: { fontFamily: F.regular, borderWidth: 1, borderRadius: ms(22), paddingHorizontal: ms(16), paddingVertical: vs(10), fontSize: fs(14) },
  counter: { fontFamily: F.regular, position: 'absolute', right: ms(14), bottom: vs(-14), fontSize: fs(9), color: C.textMuted },
  sendBtn: { width: s(42), height: s(42), borderRadius: s(21), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

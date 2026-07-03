// ─────────────────────────────────────────────
// Peolia — DMConversationScreen
// src/screens/DMConversationScreen.jsx
//
// 1:1 direct-message thread. Renders on top of everything as an absolute overlay
// (wired in src/app/index.tsx). Realtime messages + reactions, image messages
// (private dm-media bucket → signed URLs), long-press action sheet with reactions
// and delete-for-me / delete-for-everyone.
//
// Props: otherUserId: string, onBack: () => void
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useBlocks } from '../context/BlockContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabase';

import { fs, ms, vs, s, SCREEN_WIDTH } from '../utils/peoliaScale';
import { clockTime } from '../utils/timeUtils';
import {
  getOrCreateDMConversation,
  markConversationRead,
  generateDMSignedUrl,
  dmInitials,
  getConversationPref,
  setConversationPref,
  isMuted,
  MUTE_OPTIONS,
} from '../lib/dmUtils';

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];
const OTHER_AVATAR_BG = '#059669';   // matches the other-citizen avatar elsewhere in the app
const MSG_PAGE = 50;                 // messages per page (initial load + scroll-back)

const WAVE_EMOJIS = {
  'Tech': '💻', 'Love': '❤️', 'Money': '💰', 'Life': '🌱',
  'Society': '🌍', 'Politics': '🏛️', 'Food': '🍕', 'Health': '💪',
  'Sports': '⚽', 'Entertainment': '🎬', 'Science': '🔬',
  'Education': '📚', 'Environment': '🌿',
};
const capWave = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : 'Tech');

export default function DMConversationScreen({ otherUserId, onBack, onOpenSenti, onOpenProfile }) {
  const scheme = usePeoliaScheme();
  const C      = getPeoliaColors(scheme);
  const st     = makeStyles(C);
  const insets = useSafeAreaInsets();
  const { block } = useBlocks();

  const [conversationId,  setConversationId]  = useState(null);
  const [messages,        setMessages]        = useState([]);
  const [otherUser,       setOtherUser]       = useState(null);
  const [currentUserId,   setCurrentUserId]   = useState(null);
  const [isParticipant1,  setIsParticipant1]  = useState(false);
  const [inputText,       setInputText]       = useState('');
  const [loadingConv,     setLoadingConv]     = useState(true);
  const [convBlocked,     setConvBlocked]     = useState(false);  // can't open (RLS block) — show notice
  const [loadingOlder,    setLoadingOlder]    = useState(false);  // scroll-back page fetch
  const [sendingImage,    setSendingImage]    = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [viewerImageUrl,  setViewerImageUrl]  = useState(null);   // full-screen image viewer
  const [showMenu,        setShowMenu]        = useState(false);  // header ⋮ menu
  const [convPref,        setConvPref]        = useState(null);   // { pinned, archived, muted_until }

  const flatListRef     = useRef(null);
  const conversationRef = useRef(null);
  const currentUserRef  = useRef(null);
  const isP1Ref         = useRef(false);
  const messagesRef     = useRef([]);
  // Scroll-back pagination guards
  const hasOlderRef          = useRef(false);
  const loadingOlderRef      = useRef(false);
  const initialScrollDoneRef = useRef(false);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const scrollToEnd = (animated) =>
    requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated }));

  // ── Attach a signed URL to an image message ──
  const withSignedUrl = useCallback(async (msg) => {
    if (!msg?.image_path) return msg;
    const imageUrl = await generateDMSignedUrl(supabase, msg.image_path);
    return { ...msg, imageUrl };
  }, []);

  // ── Enrich a batch of message rows (senti previews + signed image URLs) ──
  const enrichRows = useCallback(async (rows) => {
    const sentiIds = [...new Set(rows.filter((m) => m.senti_id).map((m) => m.senti_id))];
    const sentiMap = {};
    if (sentiIds.length) {
      const { data: sentis } = await supabase
        .from('sentis').select('id, question, wave, image_url').in('id', sentiIds);
      (sentis ?? []).forEach((sn) => { sentiMap[sn.id] = sn; });
    }
    return Promise.all(rows.map(async (m) => ({
      ...(await withSignedUrl(m)),
      senti: m.senti_id ? (sentiMap[m.senti_id] ?? null) : null,
    })));
  }, [withSignedUrl]);

  // ── Load the NEWEST page of messages ──
  // Fetch descending (newest first) then reverse for display — ascending+limit
  // would return the OLDEST page and hide new messages past MSG_PAGE.
  const loadMessages = useCallback(async (convId) => {
    const { data, error } = await supabase
      .from('dm_messages')
      .select('*, dm_message_reactions(id, emoji, user_id)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(MSG_PAGE);
    if (error) { console.error('loadMessages error', error); return; }

    const rows = (data ?? []).reverse();
    hasOlderRef.current = (data?.length ?? 0) === MSG_PAGE;
    const enriched = await enrichRows(rows);
    setMessages(enriched);
    scrollToEnd(false);
    // Let the initial scroll settle before onStartReached may fire
    setTimeout(() => { initialScrollDoneRef.current = true; }, 600);
  }, [enrichRows]);

  // ── Scroll-back: load the page BEFORE the oldest loaded message ──
  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasOlderRef.current || !initialScrollDoneRef.current) return;
    const oldest = messagesRef.current[0]?.created_at;
    const convId = conversationRef.current;
    if (!oldest || !convId) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from('dm_messages')
        .select('*, dm_message_reactions(id, emoji, user_id)')
        .eq('conversation_id', convId)
        .lt('created_at', oldest)
        .order('created_at', { ascending: false })
        .limit(MSG_PAGE);
      if (error) throw error;

      hasOlderRef.current = (data?.length ?? 0) === MSG_PAGE;
      const rows = (data ?? []).reverse();
      if (rows.length) {
        const enriched = await enrichRows(rows);
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...enriched.filter((m) => !seen.has(m.id)), ...prev];
        });
      }
    } catch (err) {
      console.error('loadOlder error', err);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [enrichRows]);

  // ── Mount: resolve user + conversation, load, subscribe ──
  useEffect(() => {
    let cancelled = false;
    let channel = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      if (!uid || cancelled) { setLoadingConv(false); return; }
      setCurrentUserId(uid);
      currentUserRef.current = uid;

      const p1 = uid < otherUserId;
      setIsParticipant1(p1);
      isP1Ref.current = p1;

      // Other user's profile
      const { data: ou } = await supabase
        .from('users')
        .select('id, display_name, username, avatar_initials, avatar_url')
        .eq('id', otherUserId)
        .maybeSingle();
      if (!cancelled) setOtherUser(ou ?? null);

      // Conversation
      let convId = null;
      try {
        convId = await getOrCreateDMConversation(supabase, uid, otherUserId);
      } catch (err) {
        console.error('getOrCreateDMConversation error', err);
        // 42501 = RLS conv_insert rejected → a block exists between the pair.
        if (!cancelled) { setConvBlocked(err?.code === '42501'); setLoadingConv(false); }
        return;
      }
      if (cancelled) return;
      setConversationId(convId);
      conversationRef.current = convId;

      await loadMessages(convId);
      await markConversationRead(supabase, convId, uid, p1);
      getConversationPref(supabase, uid, convId).then((p) => { if (!cancelled) setConvPref(p); });
      if (!cancelled) setLoadingConv(false);

      // ── Realtime ──
      // Unique topic per mount — reusing `dm-conv-<id>` after a fast-refresh or a
      // quick close/reopen returns an already-subscribed channel, which throws
      // "cannot add postgres_changes callbacks after subscribe()".
      if (cancelled) return;
      channel = supabase
        .channel(`dm-conv-${convId}-${Date.now()}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${convId}` },
          async (payload) => {
            const row = payload.new;
            if (messagesRef.current.some((m) => m.id === row.id)) return;  // dedupe
            let senti = null;
            if (row.senti_id) {
              const { data: sd } = await supabase
                .from('sentis').select('id, question, wave, image_url').eq('id', row.senti_id).maybeSingle();
              senti = sd ?? null;
            }
            const enriched = await withSignedUrl({ ...row, dm_message_reactions: [], senti });
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, enriched]));
            if (row.sender_id !== currentUserRef.current) {
              markConversationRead(supabase, conversationRef.current, currentUserRef.current, isP1Ref.current);
            }
            scrollToEnd(true);
          })
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${convId}` },
          async (payload) => {
            const row = payload.new;
            const prevMsg = messagesRef.current.find((m) => m.id === row.id);
            if (!prevMsg) return;
            // Reuse the already-signed URL unless the image changed; preserve the
            // senti preview + reactions (the payload only carries raw columns).
            const sameImage = row.image_path && row.image_path === prevMsg.image_path;
            const base = sameImage ? { ...row, imageUrl: prevMsg.imageUrl } : await withSignedUrl({ ...row });
            const merged = {
              ...base,
              dm_message_reactions: prevMsg.dm_message_reactions ?? [],
              senti: prevMsg.senti ?? null,
            };
            setMessages((prev) => prev.map((m) => (m.id === row.id ? merged : m)));
          })
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'dm_message_reactions' },
          (payload) => {
            const r = payload.new;
            setMessages((prev) => prev.map((m) => {
              if (m.id !== r.message_id) return m;
              const others = (m.dm_message_reactions ?? []).filter((x) => x.user_id !== r.user_id);
              return { ...m, dm_message_reactions: [...others, { id: r.id, emoji: r.emoji, user_id: r.user_id }] };
            }));
          })
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'dm_message_reactions' },
          (payload) => {
            const deletedId = payload.old?.id;
            if (!deletedId) return;
            setMessages((prev) => prev.map((m) => {
              const reactions = m.dm_message_reactions ?? [];
              if (!reactions.some((x) => x.id === deletedId)) return m;
              return { ...m, dm_message_reactions: reactions.filter((x) => x.id !== deletedId) };
            }));
          })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId]);

  // ── Send text ──
  const sendMessage = useCallback(async () => {
    const body = inputText.trim();
    if (!body || !conversationId || !currentUserId) return;
    setInputText('');   // optimistic clear
    const { error } = await supabase.from('dm_messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      body,
    });
    if (error) {
      console.error('sendMessage error', error);
      setInputText(body);   // restore
      Alert.alert('Could not send', 'Please try again.');
    }
  }, [inputText, conversationId, currentUserId]);

  // ── Send image (private bucket: store path, mirror FloatScreen upload) ──
  const sendImage = useCallback(async () => {
    if (!conversationId || !currentUserId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to send an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,           // REQUIRED — decode() needs the base64 (fetch().arrayBuffer is broken in RN)
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) { Alert.alert('Could not read image', 'Please try a different photo.'); return; }

    setSendingImage(true);
    try {
      const ext  = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
      const contentType =
        asset.mimeType ?? (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
      const path = `${conversationId}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('dm-media')
        .upload(path, decode(asset.base64), { contentType });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('dm_messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        image_path: path,
      });
      if (insErr) throw insErr;
    } catch (err) {
      console.error('sendImage error', err);
      Alert.alert('Could not send image', 'Please try again.');
    } finally {
      setSendingImage(false);
    }
  }, [conversationId, currentUserId]);

  // ── Long-press → action sheet ──
  const handleLongPress = (message) => {
    if (message.deleted_for_all) return;
    setSelectedMessage(message);
    setShowActionSheet(true);
  };
  const closeActionSheet = () => { setShowActionSheet(false); setSelectedMessage(null); };

  // ── Reactions ──
  const applyReaction = useCallback(async (message, emoji) => {
    if (!message || !currentUserId) return;
    const existing = (message.dm_message_reactions ?? []).find((r) => r.user_id === currentUserId);

    if (existing && existing.emoji === emoji) {
      // toggle off
      setMessages((prev) => prev.map((m) => m.id !== message.id ? m : {
        ...m,
        dm_message_reactions: (m.dm_message_reactions ?? []).filter((r) => r.user_id !== currentUserId),
      }));
      const { error } = await supabase.from('dm_message_reactions')
        .delete().eq('message_id', message.id).eq('user_id', currentUserId);
      if (error) console.error('reaction delete error', error);
    } else {
      // add or change
      setMessages((prev) => prev.map((m) => m.id !== message.id ? m : {
        ...m,
        dm_message_reactions: [
          ...(m.dm_message_reactions ?? []).filter((r) => r.user_id !== currentUserId),
          { id: existing?.id ?? `temp-${Date.now()}`, emoji, user_id: currentUserId },
        ],
      }));
      const { error } = await supabase.from('dm_message_reactions')
        .upsert({ message_id: message.id, user_id: currentUserId, emoji }, { onConflict: 'message_id,user_id' });
      if (error) console.error('reaction upsert error', error);
    }
  }, [currentUserId]);

  const handleReaction = (emoji) => {
    if (selectedMessage) applyReaction(selectedMessage, emoji);
    closeActionSheet();
  };
  const handleReactionFromPill = (emoji, message) => applyReaction(message, emoji);

  // ── Delete ──
  const performDeleteForMe = async (msg) => {
    if (!msg || !currentUserId) return;
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));   // RLS hides it after; local removal is correct
    const { error } = await supabase.rpc('dm_hide_message', { p_message_id: msg.id });
    if (error) console.error('deleteForMe error', error);
  };

  const handleDeleteForMe = () => {
    const msg = selectedMessage;
    closeActionSheet();
    if (!msg) return;
    Alert.alert(
      'Delete for you?',
      'This removes the message from your view only. The other person will still see it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete for me', style: 'destructive', onPress: () => performDeleteForMe(msg) },
      ],
    );
  };

  const performDeleteForAll = async (msg) => {
    if (!msg || msg.sender_id !== currentUserId) return;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, deleted_for_all: true } : m)));
    const { error } = await supabase.rpc('dm_delete_message_for_all', { p_message_id: msg.id });
    if (error) console.error('deleteForAll error', error);
  };

  const handleDeleteForAll = () => {
    const msg = selectedMessage;
    closeActionSheet();
    if (!msg || msg.sender_id !== currentUserId) return;
    Alert.alert(
      'Delete for everyone?',
      'This replaces the message with "Message deleted" for both of you. This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete for everyone', style: 'destructive', onPress: () => performDeleteForAll(msg) },
      ],
    );
  };

  // ── Header ⋮ menu actions ──
  const muted  = isMuted(convPref);
  const pinned = !!convPref?.pinned;

  const updatePref = async (changes) => {
    const prev = convPref;
    setConvPref({ ...(convPref ?? {}), ...changes });
    try {
      await setConversationPref(supabase, currentUserId, conversationId, changes);
    } catch (e) {
      console.error('updatePref error', e);
      setConvPref(prev);
    }
  };

  const handleViewProfile = () => { setShowMenu(false); onOpenProfile?.(otherUserId); };

  const handleTogglePin = () => { setShowMenu(false); updatePref({ pinned: !pinned }); };

  const handleMute = () => {
    setShowMenu(false);
    if (muted) { updatePref({ muted_until: null }); return; }
    Alert.alert('Mute notifications', 'Mute this conversation for…', [
      { text: '1 day',  onPress: () => updatePref({ muted_until: MUTE_OPTIONS.day() }) },
      { text: '1 week', onPress: () => updatePref({ muted_until: MUTE_OPTIONS.week() }) },
      { text: 'Always', onPress: () => updatePref({ muted_until: MUTE_OPTIONS.always() }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleBlock = () => {
    setShowMenu(false);
    const name = otherUser?.display_name?.trim() || (otherUser?.username ? `@${otherUser.username}` : 'this citizen');
    Alert.alert(
      `Block ${name}?`,
      "They won't be able to see your sentis, and you won't see theirs. This also removes any follow between you.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const ok = await block(otherUserId);
            if (ok) onBack?.();
            else Alert.alert('Could not block', 'Please try again.');
          },
        },
      ],
    );
  };

  // Last message I sent that has been read → where the "Seen" receipt shows.
  const lastReadSentId = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.sender_id === currentUserId && m.is_read && !m.deleted_for_all) return m.id;
    }
    return null;
  })();

  // ── Render a message ──
  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === currentUserId;

    if (item.deleted_for_all) {
      return (
        <View style={[st.msgRow, isMe ? st.rowRight : st.rowLeft]}>
          <View style={[st.bubble, st.bubbleDeleted, isMe ? st.bubbleMe : st.bubbleOther]}>
            <Text style={st.deletedText}>Message deleted</Text>
          </View>
        </View>
      );
    }

    // Group reactions by emoji
    const groupsMap = {};
    (item.dm_message_reactions ?? []).forEach((r) => {
      const g = groupsMap[r.emoji] ?? { emoji: r.emoji, count: 0, iMine: false };
      g.count += 1;
      if (r.user_id === currentUserId) g.iMine = true;
      groupsMap[r.emoji] = g;
    });
    const groups = Object.values(groupsMap);

    return (
      <View style={[st.msgRow, isMe ? st.rowRight : st.rowLeft]}>
        {!isMe && (
          <View style={st.smallAvatar}>
            {otherUser?.avatar_url
              ? <Image source={{ uri: otherUser.avatar_url }} style={st.avatarFill} resizeMode="cover" />
              : <Text style={st.smallAvatarText}>{dmInitials(otherUser)}</Text>}
          </View>
        )}

        <View style={st.bubbleCol}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (item.senti_id) onOpenSenti?.(item.senti_id);
              else if (item.imageUrl) setViewerImageUrl(item.imageUrl);
            }}
            onLongPress={() => handleLongPress(item)}
            delayLongPress={250}
          >
            <View style={[st.bubble, isMe ? st.bubbleMe : st.bubbleOther]}>
              {/* Shared senti preview */}
              {item.senti_id && (
                <View style={st.sentiCard}>
                  {!!item.senti?.image_url && (
                    <Image source={{ uri: item.senti.image_url }} style={st.sentiThumb} resizeMode="cover" />
                  )}
                  <View style={st.sentiBody}>
                    <Text style={st.sentiWave}>
                      {WAVE_EMOJIS[capWave(item.senti?.wave)] ?? '🌊'} {capWave(item.senti?.wave)}
                    </Text>
                    <Text style={st.sentiQuestion} numberOfLines={3}>
                      {item.senti?.question ?? 'Senti unavailable'}
                    </Text>
                    <Text style={st.sentiOpen}>View senti →</Text>
                  </View>
                </View>
              )}

              {/* Image (with loading placeholder while the signed URL resolves) */}
              {item.image_path && (
                item.imageUrl
                  ? <Image source={{ uri: item.imageUrl }} style={st.msgImage} resizeMode="cover" />
                  : <View style={[st.msgImage, st.msgImagePlaceholder]}><ActivityIndicator color={C.accent} /></View>
              )}

              {!!item.body && (
                <Text style={[st.msgText, isMe ? st.msgTextMe : st.msgTextOther]}>{item.body}</Text>
              )}
            </View>
          </TouchableOpacity>

          {groups.length > 0 && (
            <View style={[st.reactionRow, isMe ? st.reactionRowRight : st.reactionRowLeft]}>
              {groups.map((g) => (
                <TouchableOpacity
                  key={g.emoji}
                  style={[st.reactionPill, g.iMine ? st.reactionPillMine : st.reactionPillOther]}
                  onPress={() => handleReactionFromPill(g.emoji, item)}
                  activeOpacity={0.7}
                >
                  <Text style={st.reactionEmoji}>{g.emoji}</Text>
                  <Text style={st.reactionCount}>{g.count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[st.metaRow, isMe ? st.metaRight : st.metaLeft]}>
            <Text style={st.timestamp}>{clockTime(item.created_at)}</Text>
            {item.id === lastReadSentId && (
              <View style={st.seenRow}>
                <Text style={st.seenText}>Seen</Text>
                <Icon name="ti-check" size={fs(11)} color={C.accent} />
                <View style={st.seenCheck2}><Icon name="ti-check" size={fs(11)} color={C.accent} /></View>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const myReactionEmoji = (selectedMessage?.dm_message_reactions ?? [])
    .find((r) => r.user_id === currentUserId)?.emoji ?? null;

  return (
    <View style={st.screen}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="ti-chevron-left" size={fs(22)} color={C.textPrimary} />
        </TouchableOpacity>
        {loadingConv || !otherUser ? (
          <>
            <View style={[st.headerAvatar, st.skelTone]} />
            <View style={st.headerNames}><View style={st.skelNameBar} /></View>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={st.headerAvatar}
              activeOpacity={0.8}
              onPress={() => onOpenProfile?.(otherUserId)}
            >
              {otherUser?.avatar_url
                ? <Image source={{ uri: otherUser.avatar_url }} style={st.avatarFill} resizeMode="cover" />
                : <Text style={st.headerAvatarText}>{dmInitials(otherUser)}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={st.headerNames} activeOpacity={0.8} onPress={() => onOpenProfile?.(otherUserId)}>
              <View style={st.headerNameRow}>
                <Text style={st.headerName} numberOfLines={1}>
                  {otherUser?.display_name?.trim() || otherUser?.username || 'Citizen'}
                </Text>
                {muted && <Icon name="ti-bell-off" size={fs(13)} color={C.textMuted} />}
              </View>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity onPress={() => setShowMenu(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Icon name="ti-dots-vertical" size={fs(20)} color={C.textMuted} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={st.flex}
        keyboardVerticalOffset={Platform.OS === 'android' ? vs(60) : 0}
      >
        {convBlocked ? (
          <View style={st.blockedWrap}>
            <Icon name="ti-ban" size={fs(34)} color={C.textMuted} />
            <Text style={st.blockedTitle}>You can&apos;t message this citizen</Text>
            <Text style={st.blockedBody}>
              Either you&apos;ve blocked each other, or they&apos;re not accepting messages from you.
            </Text>
          </View>
        ) : loadingConv ? (
          <View style={st.skeletonWrap}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const mine = i % 2 === 1;
              return (
                <View key={i} style={[st.skelRow, mine ? st.rowRight : st.rowLeft]}>
                  {!mine && <View style={st.skelAvatar} />}
                  <View style={[st.skelBubble, { width: ms(110 + (i % 3) * 45) }]} />
                </View>
              );
            })}
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={st.listContent}
            onLayout={() => scrollToEnd(false)}
            onStartReached={loadOlder}
            onStartReachedThreshold={0.2}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListHeaderComponent={
              loadingOlder
                ? <View style={st.olderLoader}><ActivityIndicator color={C.accent} size="small" /></View>
                : null
            }
            ListEmptyComponent={
              <View style={st.emptyWrap}>
                <Text style={st.emptyText}>Say hi 👋</Text>
              </View>
            }
          />
        )}

        {/* Input bar — hidden when the pair can't message */}
        {!convBlocked && (
        <View style={[st.inputBar, { paddingBottom: vs(8) + insets.bottom }]}>
          <TouchableOpacity onPress={sendImage} disabled={sendingImage} style={st.inputIconBtn} activeOpacity={0.7}>
            {sendingImage
              ? <ActivityIndicator color={C.accent} size="small" />
              : <Icon name="ti-photo" size={fs(22)} color={C.textSecondary} />}
          </TouchableOpacity>
          <TextInput
            style={st.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message..."
            placeholderTextColor={C.textMuted}
            multiline
          />
          <TouchableOpacity onPress={sendMessage} style={st.inputIconBtn} activeOpacity={0.7}>
            <Icon name="ti-send" size={fs(22)} color={inputText.trim() ? C.accent : C.textMuted} />
          </TouchableOpacity>
        </View>
        )}
      </KeyboardAvoidingView>

      {/* Full-screen image viewer */}
      <Modal visible={!!viewerImageUrl} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewerImageUrl(null)}>
        <Pressable style={st.viewerBackdrop} onPress={() => setViewerImageUrl(null)}>
          {!!viewerImageUrl && (
            <Image source={{ uri: viewerImageUrl }} style={st.viewerImage} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>

      {/* Action sheet */}
      <Modal visible={showActionSheet} transparent animationType="fade" onRequestClose={closeActionSheet}>
        <Pressable style={st.sheetBackdrop} onPress={closeActionSheet}>
          <Pressable style={[st.sheet, { paddingBottom: vs(16) + insets.bottom }]} onPress={() => {}}>
            <View style={st.sheetHandle} />

            {/* Reaction picker */}
            <View style={st.reactionPicker}>
              {REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[st.reactionPick, myReactionEmoji === emoji && st.reactionPickActive]}
                  onPress={() => handleReaction(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={st.reactionPickEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={st.sheetDivider} />

            <TouchableOpacity style={st.sheetRow} onPress={handleDeleteForMe} activeOpacity={0.7}>
              <Icon name="ti-trash" size={fs(18)} color={C.textSecondary} />
              <Text style={st.sheetRowText}>Delete for me</Text>
            </TouchableOpacity>

            {selectedMessage?.sender_id === currentUserId && (
              <TouchableOpacity style={st.sheetRow} onPress={handleDeleteForAll} activeOpacity={0.7}>
                <Icon name="ti-ban" size={fs(18)} color="#DC2626" />
                <Text style={[st.sheetRowText, { color: '#DC2626' }]}>Delete for everyone</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header ⋮ menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={st.menuBackdrop} onPress={() => setShowMenu(false)}>
          <View style={[st.menuCard, { top: vs(54) + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0) }]}>
            <TouchableOpacity style={st.menuItem} onPress={handleViewProfile} activeOpacity={0.7}>
              <Icon name="ti-user" size={fs(16)} color={C.textSecondary} />
              <Text style={st.menuLabel}>View profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.menuItem} onPress={handleMute} activeOpacity={0.7}>
              <Icon name="ti-bell-off" size={fs(16)} color={C.textSecondary} />
              <Text style={st.menuLabel}>{muted ? 'Unmute' : 'Mute notifications'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.menuItem} onPress={handleTogglePin} activeOpacity={0.7}>
              <Icon name="ti-pin" size={fs(16)} color={C.textSecondary} />
              <Text style={st.menuLabel}>{pinned ? 'Unpin' : 'Pin to top'}</Text>
            </TouchableOpacity>
            <View style={st.menuDivider} />
            <TouchableOpacity style={st.menuItem} onPress={handleBlock} activeOpacity={0.7}>
              <Icon name="ti-ban" size={fs(16)} color="#DC2626" />
              <Text style={[st.menuLabel, { color: '#DC2626' }]}>Block citizen</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  flex: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: ms(8),
    paddingHorizontal: ms(12), paddingTop: vs(8), paddingBottom: vs(8),
    borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  backBtn: { padding: ms(2) },
  headerAvatar: {
    width: s(36), height: s(36), borderRadius: s(18), backgroundColor: OTHER_AVATAR_BG,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  headerAvatarText: { letterSpacing: -0.2, fontSize: fs(15), fontFamily: F.extraBold, color: '#FFFFFF' },
  avatarFill: { width: '100%', height: '100%' },
  skelTone:    { backgroundColor: C.surfaceAlt },
  skelNameBar: { width: ms(130), height: vs(15), borderRadius: ms(6), backgroundColor: C.surfaceAlt },
  headerNames: { flex: 1 },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  headerName:   { letterSpacing: -0.2, fontSize: fs(16), fontFamily: F.extraBold, color: C.textPrimary, flexShrink: 1 },

  // Header ⋮ dropdown menu
  menuBackdrop: { flex: 1 },
  menuCard: {
    position: 'absolute', right: ms(10), width: ms(200),
    backgroundColor: C.sheetBg, borderRadius: ms(13), borderWidth: 0.5, borderColor: C.border,
    paddingVertical: vs(5),
  },
  menuItem:    { flexDirection: 'row', alignItems: 'center', gap: ms(10), paddingVertical: vs(12), paddingHorizontal: ms(14) },
  menuLabel:   { fontSize: fs(14), fontFamily: F.semiBold, color: C.textPrimary },
  menuDivider: { height: 0.5, backgroundColor: C.border, marginVertical: vs(3), marginHorizontal: ms(8) },

  // Loading skeleton
  skeletonWrap: { flex: 1, padding: ms(10) },
  skelRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: ms(6), marginBottom: vs(12) },
  skelAvatar: { width: s(18), height: s(18), borderRadius: s(9), backgroundColor: C.surfaceAlt },
  skelBubble: { height: vs(38), borderRadius: ms(12), backgroundColor: C.surfaceAlt },

  // List
  listContent: { padding: ms(10), gap: vs(8), flexGrow: 1 },
  olderLoader: { paddingVertical: vs(10), alignItems: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: vs(60) },
  emptyText: { fontSize: fs(15), fontFamily: F.semiBold, color: C.textMuted },
  blockedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ms(40) },
  blockedTitle: { fontSize: fs(16), fontFamily: F.extraBold, letterSpacing: -0.2, color: C.textPrimary, marginTop: vs(12), textAlign: 'center' },
  blockedBody: { fontSize: fs(13), fontFamily: F.regular, color: C.textMuted, textAlign: 'center', lineHeight: fs(19), marginTop: vs(6) },

  // Message row
  msgRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: ms(6), maxWidth: '100%' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft:  { justifyContent: 'flex-start' },
  smallAvatar: {
    width: s(18), height: s(18), borderRadius: s(9), backgroundColor: OTHER_AVATAR_BG,
    alignItems: 'center', justifyContent: 'center', marginBottom: vs(16), overflow: 'hidden',
  },
  smallAvatarText: { fontSize: fs(8), fontFamily: F.extraBold, color: '#FFFFFF' },
  bubbleCol: { maxWidth: '78%' },

  bubble: { paddingVertical: vs(8), paddingHorizontal: ms(12) },
  bubbleMe: {
    backgroundColor: C.accent,
    borderTopLeftRadius: ms(12), borderTopRightRadius: ms(12),
    borderBottomRightRadius: ms(3), borderBottomLeftRadius: ms(12),
  },
  bubbleOther: {
    backgroundColor: C.surfaceAlt,
    borderTopLeftRadius: ms(12), borderTopRightRadius: ms(12),
    borderBottomLeftRadius: ms(3), borderBottomRightRadius: ms(12),
  },
  bubbleDeleted: { backgroundColor: C.surfaceAlt },
  deletedText: { fontFamily: F.regular, fontSize: fs(13), fontStyle: 'italic', color: C.textMuted },
  msgText:      { fontFamily: F.regular, fontSize: fs(14), lineHeight: fs(20) },
  msgTextMe:    { color: '#FFFFFF' },
  msgTextOther: { color: C.textPrimary },
  msgImage: {
    width: Math.min(SCREEN_WIDTH * 0.6, ms(240)),
    height: Math.min(SCREEN_WIDTH * 0.6, ms(240)),
    borderRadius: ms(8), marginBottom: vs(2),
  },
  msgImagePlaceholder: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
  },

  // Shared senti preview card (inside a bubble)
  sentiCard: {
    width: Math.min(SCREEN_WIDTH * 0.6, ms(240)),
    backgroundColor: C.surface, borderRadius: ms(10), borderWidth: 0.5, borderColor: C.border,
    overflow: 'hidden', marginBottom: vs(2),
  },
  sentiThumb: { width: '100%', height: vs(90) },
  sentiBody:  { padding: ms(10) },
  sentiWave:  { fontSize: fs(10), fontFamily: F.bold, color: C.textSecondary, marginBottom: vs(3) },
  sentiQuestion: { fontSize: fs(13), fontFamily: F.bold, color: C.textPrimary, lineHeight: fs(18) },
  sentiOpen:  { fontSize: fs(11), fontFamily: F.bold, color: C.accent, marginTop: vs(6) },

  // Reactions on a bubble
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(4), marginTop: vs(3) },
  reactionRowRight: { justifyContent: 'flex-end' },
  reactionRowLeft:  { justifyContent: 'flex-start' },
  reactionPill: {
    flexDirection: 'row', alignItems: 'center', gap: ms(3),
    paddingVertical: vs(2), paddingHorizontal: ms(6), borderRadius: ms(20), borderWidth: 0.5,
  },
  reactionPillMine:  { backgroundColor: C.accentLight, borderColor: C.accentMid },
  reactionPillOther: { backgroundColor: C.surface, borderColor: C.border },
  reactionEmoji: { fontFamily: F.regular, fontSize: fs(11) },
  reactionCount: { fontSize: fs(10), fontFamily: F.bold, color: C.textSecondary },

  // Meta (timestamp + seen)
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: ms(5), marginTop: vs(2) },
  metaRight: { justifyContent: 'flex-end' },
  metaLeft:  { justifyContent: 'flex-start' },
  timestamp: { fontFamily: F.regular, fontSize: fs(9), color: C.textMuted },
  seenRow: { flexDirection: 'row', alignItems: 'center' },
  seenText: { fontSize: fs(9), color: C.accent, fontFamily: F.semiBold, marginRight: ms(2) },
  seenCheck2: { marginLeft: -ms(6) },   // overlap the two checks → ✓✓

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: ms(6),
    paddingHorizontal: ms(10), paddingTop: vs(8),
    borderTopWidth: 0.5, borderTopColor: C.border, backgroundColor: C.bg,
  },
  inputIconBtn: { width: s(36), height: s(36), alignItems: 'center', justifyContent: 'center' },
  input: {
    fontFamily: F.regular, flex: 1, maxHeight: vs(120),
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border, borderRadius: ms(20),
    paddingHorizontal: ms(14), paddingVertical: vs(8), fontSize: fs(14), color: C.textPrimary,
  },

  // Action sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.sheetBg,
    borderTopLeftRadius: ms(20), borderTopRightRadius: ms(20),
    borderTopWidth: 0.5, borderColor: C.sheetBorder,
    paddingHorizontal: ms(16), paddingTop: vs(10),
  },
  sheetHandle: { width: ms(36), height: vs(4), borderRadius: ms(2), backgroundColor: C.border, alignSelf: 'center', marginBottom: vs(14) },
  reactionPicker: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: vs(10) },
  reactionPick: { padding: ms(6), borderRadius: ms(20), borderWidth: 1.5, borderColor: 'transparent' },
  reactionPickActive: { borderColor: C.accent, backgroundColor: C.accentLight },
  reactionPickEmoji: { fontFamily: F.regular, fontSize: fs(26) },
  sheetDivider: { height: 0.5, backgroundColor: C.border, marginBottom: vs(6) },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12), paddingVertical: vs(13) },
  sheetRowText: { fontSize: fs(15), fontFamily: F.semiBold, color: C.textPrimary },

  // Full-screen image viewer
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', alignItems: 'center', justifyContent: 'center' },
  viewerImage:    { width: '92%', height: '80%' },
});

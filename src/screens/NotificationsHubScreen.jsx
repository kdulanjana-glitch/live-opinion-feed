// ─────────────────────────────────────────────
// Peolia — NotificationsHubScreen
// src/screens/NotificationsHubScreen.jsx
//
// Hub reached from the Profile notification icon. Shows the notifications entry
// (live unread count → opens the full list) and the DM conversation list with a
// compose (✏️) button + "New message" overlay.
//
// Props: onBack, onOpenList, onOpenDM(userId)
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
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s } from '../utils/peoliaScale';
import { relativeTime } from '../utils/timeUtils';
import { getLastMessagePreview, getMyUnreadCount, dmInitials } from '../lib/dmUtils';

// Deterministic avatar tint per citizen (matches the app's hardcoded-avatar precedent).
const DM_AVATAR_COLORS = ['#4F46E5', '#059669', '#D97706', '#7C3AED'];
const avatarColor = (id) => {
  if (!id) return DM_AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h + id.charCodeAt(i)) % DM_AVATAR_COLORS.length;
  return DM_AVATAR_COLORS[h];
};

export default function NotificationsHubScreen({ onBack, onOpenList, onOpenDM }) {
  const scheme = usePeoliaScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const { unreadCount } = useNotifications();

  const [currentUserId, setCurrentUserId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loadingConvs,  setLoadingConvs]  = useState(true);

  const [showNewMessage, setShowNewMessage] = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [searchLoading,  setSearchLoading]  = useState(false);

  const debounceRef = useRef(null);

  // ── Conversation list ──
  const fetchConversations = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setCurrentUserId(uid);
    if (!uid) { setConversations([]); setLoadingConvs(false); return; }

    const { data: convs, error } = await supabase
      .from('dm_conversations')
      .select('id, participant_1_id, participant_2_id, last_message_at, unread_p1, unread_p2, last_message_id')
      .or(`participant_1_id.eq.${uid},participant_2_id.eq.${uid}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(30);
    if (error) { console.error('fetchConversations error', error); setLoadingConvs(false); return; }

    const otherUserIds = (convs ?? []).map((c) =>
      c.participant_1_id === uid ? c.participant_2_id : c.participant_1_id);
    const lastMsgIds = (convs ?? []).map((c) => c.last_message_id).filter(Boolean);

    const [usersRes, msgsRes] = await Promise.all([
      otherUserIds.length
        ? supabase.from('users').select('id, display_name, username, avatar_initials, avatar_url').in('id', otherUserIds)
        : Promise.resolve({ data: [] }),
      lastMsgIds.length
        ? supabase.from('dm_messages').select('id, body, image_path, sender_id, deleted_for_all').in('id', lastMsgIds)
        : Promise.resolve({ data: [] }),
    ]);

    const usersById = {};
    (usersRes.data ?? []).forEach((u) => { usersById[u.id] = u; });
    const msgsById = {};
    (msgsRes.data ?? []).forEach((m) => { msgsById[m.id] = m; });

    const merged = (convs ?? []).map((c) => {
      const otherId = c.participant_1_id === uid ? c.participant_2_id : c.participant_1_id;
      return {
        ...c,
        otherUser: usersById[otherId] ?? { id: otherId, username: 'citizen', display_name: '' },
        lastMsg:   c.last_message_id ? (msgsById[c.last_message_id] ?? null) : null,
        myUnread:  getMyUnreadCount(c, uid),
      };
    });
    setConversations(merged);
    setLoadingConvs(false);
  }, []);

  useEffect(() => {
    fetchConversations();
    const channel = supabase
      .channel('dm-hub-convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_conversations' },
        () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations]);

  // ── New-message search ──
  const runSearch = useCallback(async (q) => {
    const uid = currentUserId;
    if (!q || q.length < 2) {
      // Suggested = people I follow
      setSearchLoading(true);
      if (!uid) { setSearchResults([]); setSearchLoading(false); return; }
      const { data: follows } = await supabase
        .from('follows').select('following_id').eq('follower_id', uid).limit(20);
      const ids = (follows ?? []).map((f) => f.following_id);
      if (!ids.length) { setSearchResults([]); setSearchLoading(false); return; }
      const { data: users } = await supabase
        .from('users').select('id, display_name, username, avatar_initials, avatar_url').in('id', ids);
      setSearchResults(users ?? []);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const { data } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_initials, avatar_url')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(20);
    setSearchResults((data ?? []).filter((u) => u.id !== uid));
    setSearchLoading(false);
  }, [currentUserId]);

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text.trim()), 300);
  };

  // Load suggested list when the overlay opens
  const openNewMessage = () => {
    setShowNewMessage(true);
    setSearchQuery('');
    runSearch('');
  };

  const pickCitizen = (userId) => {
    setShowNewMessage(false);
    onOpenDM?.(userId);
  };

  // ── Renderers ──
  const renderConversation = ({ item }) => {
    const name = item.otherUser?.display_name?.trim() || item.otherUser?.username || 'Citizen';
    const preview = getLastMessagePreview(item.lastMsg, currentUserId);
    const unread = item.myUnread > 0;
    return (
      <TouchableOpacity
        style={[st.convRow, unread && st.convRowUnread]}
        onPress={() => onOpenDM?.(item.otherUser.id)}
        activeOpacity={0.7}
      >
        <View style={[st.convAvatar, { backgroundColor: avatarColor(item.otherUser.id) }]}>
          {item.otherUser?.avatar_url
            ? <Image source={{ uri: item.otherUser.avatar_url }} style={st.avatarFill} resizeMode="cover" />
            : <Text style={st.convAvatarText}>{dmInitials(item.otherUser)}</Text>}
        </View>
        <View style={st.convMid}>
          <Text style={st.convName} numberOfLines={1}>{name}</Text>
          <Text
            style={[st.convPreview, unread ? st.convPreviewUnread : null]}
            numberOfLines={1}
          >
            {preview || 'No messages yet'}
          </Text>
        </View>
        <View style={st.convRight}>
          <Text style={st.convTime}>{relativeTime(item.last_message_at)}</Text>
          {unread && (
            <View style={st.convBadge}>
              <Text style={st.convBadgeText}>{item.myUnread > 99 ? '99+' : item.myUnread}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCitizen = ({ item }) => {
    const name = item.display_name?.trim() || item.username || 'Citizen';
    return (
      <TouchableOpacity style={st.citizenRow} onPress={() => pickCitizen(item.id)} activeOpacity={0.7}>
        <View style={[st.convAvatar, { backgroundColor: avatarColor(item.id) }]}>
          {item?.avatar_url
            ? <Image source={{ uri: item.avatar_url }} style={st.avatarFill} resizeMode="cover" />
            : <Text style={st.convAvatarText}>{dmInitials(item)}</Text>}
        </View>
        <View style={st.convMid}>
          <Text style={st.convName} numberOfLines={1}>{name}</Text>
          <Text style={st.citizenHandle} numberOfLines={1}>@{item.username}</Text>
        </View>
        <View style={st.messagePill}>
          <Text style={st.messagePillText}>Message</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={st.screen}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="ti-chevron-left" size={fs(22)} color={C.textPrimary} />
          <Text style={st.headerTitle}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openNewMessage} style={st.composeBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="ti-edit" size={fs(20)} color={C.accent} />
        </TouchableOpacity>
      </View>

      {/* Notifications pill */}
      <TouchableOpacity style={[st.card, st.cardAccent]} onPress={onOpenList} activeOpacity={0.85}>
        <View style={[st.iconCircle, { backgroundColor: C.accentLight }]}>
          <Icon name="ti-bell" size={fs(18)} color={C.accent} />
        </View>
        <View style={st.cardMid}>
          <Text style={st.cardTitle}>Notifications</Text>
          <Text style={st.cardSub}>
            {unreadCount > 0 ? `${unreadCount} new update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
          </Text>
        </View>
        <View style={st.cardRight}>
          {unreadCount > 0 && (
            <View style={st.badge}>
              <Text style={st.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
          <Icon name="ti-chevron-right" size={fs(16)} color={C.textMuted} />
        </View>
      </TouchableOpacity>

      {/* Messages */}
      <Text style={st.sectionLabel}>MESSAGES</Text>
      {loadingConvs ? (
        <View style={st.loader}><ActivityIndicator color={C.accent} /></View>
      ) : conversations.length === 0 ? (
        <View style={st.emptyRow}>
          <Icon name="ti-message-2" size={fs(18)} color={C.textMuted} />
          <Text style={st.emptyText}>No messages yet</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={{ paddingBottom: vs(20) }}
        />
      )}

      {/* New message overlay (in-screen, not a Modal) */}
      {showNewMessage && (
        <View style={st.overlay}>
          <View style={st.header}>
            <Text style={st.headerTitle}>New message</Text>
            <TouchableOpacity onPress={() => setShowNewMessage(false)} style={st.composeBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="ti-x" size={fs(20)} color={C.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={st.searchWrap}>
            <Icon name="ti-search" size={fs(16)} color={C.textMuted} />
            <TextInput
              style={st.searchInput}
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search citizens..."
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {searchQuery.length < 2 && <Text style={st.sectionLabel}>SUGGESTED</Text>}

          {searchLoading ? (
            <View style={st.loader}><ActivityIndicator color={C.accent} /></View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderCitizen}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: vs(20) }}
              ListEmptyComponent={
                <Text style={st.noResults}>
                  {searchQuery.length >= 2 ? 'No citizens found' : 'Follow citizens to see suggestions'}
                </Text>
              }
            />
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: ms(14), paddingTop: vs(10), paddingBottom: vs(8),
  },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  headerTitle: { fontSize: fs(18), fontWeight: '800', color: C.textPrimary },
  composeBtn: {
    width: s(36), height: s(36), borderRadius: s(18),
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: ms(9),
    marginHorizontal: ms(12), marginTop: vs(4),
    backgroundColor: C.surface, borderRadius: ms(13),
    paddingVertical: vs(11), paddingHorizontal: ms(12),
  },
  cardAccent: { borderWidth: 0.5, borderColor: C.accent },
  iconCircle: { width: s(38), height: s(38), borderRadius: s(19), alignItems: 'center', justifyContent: 'center' },
  cardMid:    { flex: 1 },
  cardTitle:  { fontSize: fs(15), fontWeight: '800', color: C.textPrimary },
  cardSub:    { fontSize: fs(12), color: C.textSecondary, marginTop: vs(2) },
  cardRight:  { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  badge:      { backgroundColor: C.accent, borderRadius: ms(12), paddingVertical: vs(2), paddingHorizontal: ms(7) },
  badgeText:  { fontSize: fs(11), color: '#FFFFFF', fontWeight: '800' },

  sectionLabel: {
    fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, color: C.textMuted,
    marginHorizontal: ms(14), marginTop: vs(16), marginBottom: vs(6),
  },
  loader:   { paddingVertical: vs(28), alignItems: 'center', justifyContent: 'center' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8), marginHorizontal: ms(14), paddingVertical: vs(16) },
  emptyText: { fontSize: fs(13), color: C.textMuted, fontWeight: '600' },

  // Conversation row
  convRow: {
    flexDirection: 'row', alignItems: 'center', gap: ms(10),
    paddingVertical: vs(10), paddingHorizontal: ms(14),
  },
  convRowUnread: { backgroundColor: C.accentLight },
  convAvatar: {
    width: s(40), height: s(40), borderRadius: s(20),
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  convAvatarText: { fontSize: fs(16), fontWeight: '800', color: '#FFFFFF' },
  avatarFill: { width: '100%', height: '100%' },
  convMid:  { flex: 1 },
  convName: { fontSize: fs(14), fontWeight: '700', color: C.textPrimary },
  convPreview: { fontSize: fs(12), color: C.textMuted, marginTop: vs(1) },
  convPreviewUnread: { color: C.accent, fontWeight: '600' },
  convRight: { alignItems: 'flex-end', gap: vs(4) },
  convTime:  { fontSize: fs(10), color: C.textMuted },
  convBadge: { minWidth: s(18), height: s(18), borderRadius: s(9), backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ms(4) },
  convBadgeText: { fontSize: fs(9), color: '#FFFFFF', fontWeight: '800' },

  // New message overlay
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: ms(8),
    marginHorizontal: ms(14), marginTop: vs(4),
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
    borderRadius: ms(12), paddingHorizontal: ms(12), paddingVertical: vs(9),
  },
  searchInput: { flex: 1, fontSize: fs(14), color: C.textPrimary, padding: 0 },
  noResults: { fontSize: fs(13), color: C.textMuted, textAlign: 'center', marginTop: vs(20) },

  // Citizen row (new message)
  citizenRow: {
    flexDirection: 'row', alignItems: 'center', gap: ms(10),
    paddingVertical: vs(10), paddingHorizontal: ms(14),
  },
  citizenHandle: { fontSize: fs(12), color: C.textMuted, marginTop: vs(1) },
  messagePill: {
    paddingVertical: vs(6), paddingHorizontal: ms(14), borderRadius: ms(20),
    backgroundColor: C.accent,
  },
  messagePillText: { fontSize: fs(13), fontWeight: '700', color: '#FFFFFF' },
});

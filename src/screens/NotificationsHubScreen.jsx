// ─────────────────────────────────────────────
// Peolia — NotificationsHubScreen
// src/screens/NotificationsHubScreen.jsx
//
// Hub reached from the Profile notification icon: notifications entry + DM
// conversation list (pin / mute / archive aware), compose, and a ⋮ menu
// (Archived, Block users, Notification settings).
//
// Props: onBack, onOpenList, onOpenDM(userId), onOpenNotificationSettings
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
  Platform,
  StatusBar,
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
} from 'react-native';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../context/NotificationContext';
import { useBlocks } from '../context/BlockContext';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s } from '../utils/peoliaScale';
import { relativeTime } from '../utils/timeUtils';
import { getLastMessagePreview, getMyUnreadCount, dmInitials, setConversationPref, isMuted } from '../lib/dmUtils';

// Deterministic avatar tint per citizen (matches the app's hardcoded-avatar precedent).
const DM_AVATAR_COLORS = ['#4F46E5', '#059669', '#D97706', '#7C3AED'];
const avatarColor = (id) => {
  if (!id) return DM_AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h + id.charCodeAt(i)) % DM_AVATAR_COLORS.length;
  return DM_AVATAR_COLORS[h];
};

// Left-swipe row → reveals a colored action panel; past threshold fires onSwipe.
// Built on PanResponder + Animated (no gesture-handler root needed).
function SwipeRow({ children, onSwipe, label, bg, rowBg }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_, g) => { if (g.dx < 0) translateX.setValue(Math.max(g.dx, -140)); },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -90) {
          Animated.timing(translateX, { toValue: -600, duration: 180, useNativeDriver: true })
            .start(() => onSwipe?.());
        } else {
          Animated.spring(translateX, { toValue: 0, bounciness: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  // Background (and its label) is invisible at rest — only fades in while dragging.
  const bgOpacity = translateX.interpolate({
    inputRange: [-120, -16, 0],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={swipeStyles.container}>
      <Animated.View style={[swipeStyles.bg, { backgroundColor: bg, opacity: bgOpacity }]}>
        <Text style={swipeStyles.label}>{label}</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }], backgroundColor: rowBg }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  container: { position: 'relative' },
  bg: { ...StyleSheet.absoluteFillObject, alignItems: 'flex-end', justifyContent: 'center', paddingRight: ms(24) },
  label: { fontSize: fs(13), fontWeight: '800', color: '#FFFFFF' },
});

export default function NotificationsHubScreen({ onBack, onOpenList, onOpenDM, onOpenNotificationSettings }) {
  const scheme = usePeoliaScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();

  const { unreadCount } = useNotifications();
  const { hiddenIds, unblock } = useBlocks();

  const [currentUserId, setCurrentUserId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loadingConvs,  setLoadingConvs]  = useState(true);

  const [showNewMessage, setShowNewMessage] = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [searchLoading,  setSearchLoading]  = useState(false);

  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showArchived,   setShowArchived]   = useState(false);
  const [showBlocked,    setShowBlocked]    = useState(false);
  const [blockedUsers,   setBlockedUsers]   = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const debounceRef = useRef(null);

  // ── Conversation list (+ per-conversation prefs) ──
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
      .limit(50);
    if (error) { console.error('fetchConversations error', error); setLoadingConvs(false); return; }

    const otherUserIds = (convs ?? []).map((c) =>
      c.participant_1_id === uid ? c.participant_2_id : c.participant_1_id);
    const lastMsgIds = (convs ?? []).map((c) => c.last_message_id).filter(Boolean);
    const convIds    = (convs ?? []).map((c) => c.id);

    const [usersRes, msgsRes, prefsRes] = await Promise.all([
      otherUserIds.length
        ? supabase.from('users').select('id, display_name, username, avatar_initials, avatar_url').in('id', otherUserIds)
        : Promise.resolve({ data: [] }),
      lastMsgIds.length
        ? supabase.from('dm_messages').select('id, body, image_path, sender_id, deleted_for_all').in('id', lastMsgIds)
        : Promise.resolve({ data: [] }),
      convIds.length
        ? supabase.from('dm_conversation_prefs').select('conversation_id, pinned, archived, muted_until').in('conversation_id', convIds)
        : Promise.resolve({ data: [] }),
    ]);

    const usersById = {};
    (usersRes.data ?? []).forEach((u) => { usersById[u.id] = u; });
    const msgsById = {};
    (msgsRes.data ?? []).forEach((m) => { msgsById[m.id] = m; });
    const prefsById = {};
    (prefsRes.data ?? []).forEach((p) => { prefsById[p.conversation_id] = p; });

    const merged = (convs ?? []).map((c) => {
      const otherId = c.participant_1_id === uid ? c.participant_2_id : c.participant_1_id;
      const pref = prefsById[c.id] ?? {};
      return {
        ...c,
        otherUser: usersById[otherId] ?? { id: otherId, username: 'citizen', display_name: '' },
        lastMsg:   c.last_message_id ? (msgsById[c.last_message_id] ?? null) : null,
        myUnread:  getMyUnreadCount(c, uid),
        pinned:    !!pref.pinned,
        archived:  !!pref.archived,
        muted:     isMuted(pref),
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

  // Visible = not blocked. Split + sort (pinned first, then most recent).
  const visible = conversations.filter((c) => !hiddenIds.includes(c.otherUser?.id));
  const sortConvs = (list) => [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bt - at;
  });
  const activeConvs   = sortConvs(visible.filter((c) => !c.archived));
  const archivedConvs = sortConvs(visible.filter((c) => c.archived));

  // ── Archive / unarchive (optimistic) ──
  const setArchived = async (conv, archived) => {
    setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, archived } : c)));
    try {
      await setConversationPref(supabase, currentUserId, conv.id, { archived });
    } catch (e) {
      console.error('archive error', e);
      fetchConversations();
    }
  };

  // ── New-message search ──
  const runSearch = useCallback(async (q) => {
    const uid = currentUserId;
    setSearchLoading(true);
    if (!q || q.length < 2) {
      if (!uid) { setSearchResults([]); setSearchLoading(false); return; }
      const { data: follows } = await supabase
        .from('follows').select('following_id').eq('follower_id', uid).limit(20);
      const ids = (follows ?? []).map((f) => f.following_id);
      if (!ids.length) { setSearchResults([]); setSearchLoading(false); return; }
      const { data: users } = await supabase
        .from('users').select('id, display_name, username, avatar_initials, avatar_url').in('id', ids);
      setSearchResults((users ?? []).filter((u) => !hiddenIds.includes(u.id)));
      setSearchLoading(false);
      return;
    }
    const { data } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_initials, avatar_url')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(20);
    setSearchResults((data ?? []).filter((u) => u.id !== uid && !hiddenIds.includes(u.id)));
    setSearchLoading(false);
  }, [currentUserId, hiddenIds]);

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text.trim()), 300);
  };

  const openNewMessage = () => { setShowNewMessage(true); setSearchQuery(''); runSearch(''); };
  const pickCitizen = (userId) => { setShowNewMessage(false); onOpenDM?.(userId); };

  // ── Blocked-users management ──
  const openBlocked = async () => {
    setShowHeaderMenu(false);
    setShowBlocked(true);
    setBlockedLoading(true);
    const { data: rows } = await supabase
      .from('user_blocks').select('blocked_id').eq('blocker_id', currentUserId);
    const ids = (rows ?? []).map((r) => r.blocked_id);
    if (!ids.length) { setBlockedUsers([]); setBlockedLoading(false); return; }
    const { data: users } = await supabase
      .from('users').select('id, display_name, username, avatar_initials, avatar_url').in('id', ids);
    setBlockedUsers(users ?? []);
    setBlockedLoading(false);
  };
  const handleUnblock = async (userId) => {
    const ok = await unblock(userId);
    if (ok) setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // ── Renderers ──
  const renderConversation = (item) => {
    const name = item.otherUser?.display_name?.trim() || item.otherUser?.username || 'Citizen';
    const preview = getLastMessagePreview(item.lastMsg, currentUserId);
    const unread = item.myUnread > 0 && !item.muted;
    return (
      <SwipeRow
        onSwipe={() => setArchived(item, true)}
        label="Archive"
        bg={C.textMuted}
        rowBg={unread ? C.accentLight : C.bg}
      >
        <TouchableOpacity
          style={st.convRow}
          onPress={() => onOpenDM?.(item.otherUser.id)}
          activeOpacity={0.7}
        >
          <View style={[st.convAvatar, { backgroundColor: avatarColor(item.otherUser.id) }]}>
            {item.otherUser?.avatar_url
              ? <Image source={{ uri: item.otherUser.avatar_url }} style={st.avatarFill} resizeMode="cover" />
              : <Text style={st.convAvatarText}>{dmInitials(item.otherUser)}</Text>}
          </View>
          <View style={st.convMid}>
            <View style={st.convNameRow}>
              {item.pinned && <Icon name="ti-pin" size={fs(11)} color={C.textMuted} />}
              <Text style={st.convName} numberOfLines={1}>{name}</Text>
              {item.muted && <Icon name="ti-bell-off" size={fs(11)} color={C.textMuted} />}
            </View>
            <Text style={[st.convPreview, unread ? st.convPreviewUnread : null]} numberOfLines={1}>
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
      </SwipeRow>
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
        <View style={st.headerActions}>
          <TouchableOpacity onPress={openNewMessage} style={st.composeBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="ti-edit" size={fs(20)} color={C.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowHeaderMenu(true)} style={st.composeBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="ti-dots-vertical" size={fs(20)} color={C.textSecondary} />
          </TouchableOpacity>
        </View>
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
      ) : activeConvs.length === 0 ? (
        <View style={st.emptyRow}>
          <Icon name="ti-message-2" size={fs(18)} color={C.textMuted} />
          <Text style={st.emptyText}>No messages yet</Text>
        </View>
      ) : (
        <FlatList
          data={activeConvs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderConversation(item)}
          contentContainerStyle={{ paddingBottom: vs(20) }}
        />
      )}

      {/* Header ⋮ menu — anchored dropdown (matches ProfileScreen) */}
      <Modal visible={showHeaderMenu} transparent animationType="fade" onRequestClose={() => setShowHeaderMenu(false)}>
        <Pressable style={st.menuBackdrop} onPress={() => setShowHeaderMenu(false)}>
          <View style={st.menuCard}>
            <TouchableOpacity style={st.menuItem} onPress={() => { setShowHeaderMenu(false); setShowArchived(true); }} activeOpacity={0.7}>
              <Icon name="ti-archive" size={fs(16)} color={C.textSecondary} />
              <Text style={st.menuLabel}>View archive</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.menuItem} onPress={openBlocked} activeOpacity={0.7}>
              <Icon name="ti-ban" size={fs(16)} color={C.textSecondary} />
              <Text style={st.menuLabel}>View blocked users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.menuItem} onPress={() => { setShowHeaderMenu(false); onOpenNotificationSettings?.(); }} activeOpacity={0.7}>
              <Icon name="ti-settings" size={fs(16)} color={C.textSecondary} />
              <Text style={st.menuLabel}>Notification settings</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* New message overlay */}
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

      {/* Archived popup */}
      <Modal visible={showArchived} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowArchived(false)}>
        <View style={st.sheetBackdrop}>
          <View style={[st.sheet, { paddingBottom: vs(16) + insets.bottom }]}>
            <View style={st.sheetHandle} />
            <View style={st.sheetHeader}>
              <Text style={st.sheetTitle}>Archived</Text>
              <TouchableOpacity onPress={() => setShowArchived(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="ti-x" size={fs(20)} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
            {archivedConvs.length === 0 ? (
              <View style={st.emptyRow}>
                <Icon name="ti-archive" size={fs(18)} color={C.textMuted} />
                <Text style={st.emptyText}>No archived conversations</Text>
              </View>
            ) : (
              <FlatList
                data={archivedConvs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: vs(10) }}
                renderItem={({ item }) => {
                  const name = item.otherUser?.display_name?.trim() || item.otherUser?.username || 'Citizen';
                  return (
                    <View style={st.sheetRow}>
                      <View style={[st.convAvatar, { backgroundColor: avatarColor(item.otherUser?.id) }]}>
                        {item.otherUser?.avatar_url
                          ? <Image source={{ uri: item.otherUser.avatar_url }} style={st.avatarFill} resizeMode="cover" />
                          : <Text style={st.convAvatarText}>{dmInitials(item.otherUser)}</Text>}
                      </View>
                      <View style={st.convMid}>
                        <Text style={st.convName} numberOfLines={1}>{name}</Text>
                        <Text style={st.convPreview} numberOfLines={1}>
                          {getLastMessagePreview(item.lastMsg, currentUserId) || 'No messages yet'}
                        </Text>
                      </View>
                      <TouchableOpacity style={st.actionPill} onPress={() => setArchived(item, false)} activeOpacity={0.7}>
                        <Text style={st.actionPillText}>Move to inbox</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Blocked-users popup */}
      <Modal visible={showBlocked} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowBlocked(false)}>
        <View style={st.sheetBackdrop}>
          <View style={[st.sheet, { paddingBottom: vs(16) + insets.bottom }]}>
            <View style={st.sheetHandle} />
            <View style={st.sheetHeader}>
              <Text style={st.sheetTitle}>Blocked users</Text>
              <TouchableOpacity onPress={() => setShowBlocked(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="ti-x" size={fs(20)} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
            {blockedLoading ? (
              <View style={st.loader}><ActivityIndicator color={C.accent} /></View>
            ) : blockedUsers.length === 0 ? (
              <View style={st.emptyRow}>
                <Icon name="ti-ban" size={fs(18)} color={C.textMuted} />
                <Text style={st.emptyText}>You haven't blocked anyone</Text>
              </View>
            ) : (
              <FlatList
                data={blockedUsers}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: vs(10) }}
                renderItem={({ item }) => {
                  const name = item.display_name?.trim() || item.username || 'Citizen';
                  return (
                    <View style={st.sheetRow}>
                      <View style={[st.convAvatar, { backgroundColor: avatarColor(item.id) }]}>
                        {item?.avatar_url
                          ? <Image source={{ uri: item.avatar_url }} style={st.avatarFill} resizeMode="cover" />
                          : <Text style={st.convAvatarText}>{dmInitials(item)}</Text>}
                      </View>
                      <View style={st.convMid}>
                        <Text style={st.convName} numberOfLines={1}>{name}</Text>
                        <Text style={st.citizenHandle} numberOfLines={1}>@{item.username}</Text>
                      </View>
                      <TouchableOpacity style={st.actionPill} onPress={() => handleUnblock(item.id)} activeOpacity={0.7}>
                        <Text style={st.actionPillText}>Unblock</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
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
  convAvatar: {
    width: s(40), height: s(40), borderRadius: s(20),
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  convAvatarText: { fontSize: fs(16), fontWeight: '800', color: '#FFFFFF' },
  avatarFill: { width: '100%', height: '100%' },
  convMid:  { flex: 1 },
  convNameRow: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  convName: { fontSize: fs(14), fontWeight: '700', color: C.textPrimary, flexShrink: 1 },
  convPreview: { fontSize: fs(12), color: C.textMuted, marginTop: vs(1) },
  convPreviewUnread: { color: C.accent, fontWeight: '600' },
  convRight: { alignItems: 'flex-end', gap: vs(4) },
  convTime:  { fontSize: fs(10), color: C.textMuted },
  convBadge: { minWidth: s(18), height: s(18), borderRadius: s(9), backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ms(4) },
  convBadgeText: { fontSize: fs(9), color: '#FFFFFF', fontWeight: '800' },

  // ⋮ dropdown menu
  menuBackdrop: { flex: 1 },
  menuCard: {
    position: 'absolute', top: vs(54) + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0), right: ms(14), width: ms(210),
    backgroundColor: C.sheetBg, borderRadius: ms(13), borderWidth: 0.5, borderColor: C.border, paddingVertical: vs(5),
  },
  menuItem:  { flexDirection: 'row', alignItems: 'center', gap: ms(10), paddingVertical: vs(12), paddingHorizontal: ms(14) },
  menuLabel: { fontSize: fs(14), fontWeight: '600', color: C.textPrimary },

  // Overlays (new message / archived / blocked)
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: ms(8),
    marginHorizontal: ms(14), marginTop: vs(4),
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
    borderRadius: ms(12), paddingHorizontal: ms(12), paddingVertical: vs(9),
  },
  searchInput: { flex: 1, fontSize: fs(14), color: C.textPrimary, padding: 0 },
  noResults: { fontSize: fs(13), color: C.textMuted, textAlign: 'center', marginTop: vs(20) },

  // Citizen row (new message / blocked)
  citizenRow: {
    flexDirection: 'row', alignItems: 'center', gap: ms(10),
    paddingVertical: vs(10), paddingHorizontal: ms(14),
  },
  citizenHandle: { fontSize: fs(12), color: C.textMuted, marginTop: vs(1) },
  messagePill: { paddingVertical: vs(6), paddingHorizontal: ms(14), borderRadius: ms(20), backgroundColor: C.accent },
  messagePillText: { fontSize: fs(13), fontWeight: '700', color: '#FFFFFF' },

  // Popup sheets (View archive / View blocked users)
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.sheetBg, maxHeight: '80%',
    borderTopLeftRadius: ms(20), borderTopRightRadius: ms(20),
    borderTopWidth: 0.5, borderColor: C.sheetBorder,
    paddingHorizontal: ms(14), paddingTop: vs(10),
  },
  sheetHandle: { width: ms(36), height: vs(4), borderRadius: ms(2), backgroundColor: C.border, alignSelf: 'center', marginBottom: vs(12) },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: vs(8) },
  sheetTitle:  { fontSize: fs(16), fontWeight: '800', color: C.textPrimary },
  sheetRow:    { flexDirection: 'row', alignItems: 'center', gap: ms(10), paddingVertical: vs(9) },
  actionPill:  { paddingVertical: vs(6), paddingHorizontal: ms(12), borderRadius: ms(20), backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border },
  actionPillText: { fontSize: fs(12), fontWeight: '700', color: C.textSecondary },
});

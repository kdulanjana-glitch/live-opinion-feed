// ─────────────────────────────────────────────
// Peolia — NotificationListScreen
// src/screens/NotificationListScreen.jsx
//
// Full notifications list. Enriches each notification row with the actor's
// profile, the related senti's question, and (for reacts) the reaction type.
//
// Props: onBack
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { supabase } from '../lib/supabase';
import Icon from '../components/Icon';

import { getNotificationLine, getReactionColor, reactionLabel } from '../utils/notificationText';
import { fs, ms, vs, s } from '../utils/peoliaScale';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatRelTime(dateStr) {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const getDisplayName = (actor) =>
  (actor?.display_name && actor.display_name.trim())
    ? actor.display_name
    : (actor?.username ? `@${actor.username}` : 'A citizen');

const initialsOf = (actor, type) => {
  if (type === 'warning') return '!';   // no actor for warnings — actor_id is null
  const ai = actor?.avatar_initials;
  if (ai && ai !== '??') return ai.toUpperCase();
  return (actor?.display_name?.[0] ?? actor?.username?.[0] ?? '?').toUpperCase();
};

export default function NotificationListScreen({ onBack }) {
  const scheme = usePeoliaScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const { navigateToNotification, markAllRead } = useNotifications();

  // Avatar colors by notification type.
  const AVATAR_STYLE = {
    react:   { bg: C.accentLight, fg: C.accent },
    voice:   { bg: C.yesBg,       fg: C.yesText },
    reply:   { bg: C.nahBg,       fg: C.nahText },
    follow:  { bg: C.yesBg,       fg: C.yesText },
    warning: { bg: C.nahBg,       fg: C.nahText },
  };

  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const uidRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    // Step 1 — current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);
    uidRef.current = user.id;

    // Step 2 — notifications
    const { data: notifData } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    const notifs = notifData ?? [];

    // Step 3 — actor profiles
    const uniqueActorIds = [...new Set(notifs.map((n) => n.actor_id).filter(Boolean))];
    let actorMap = {};
    if (uniqueActorIds.length) {
      const { data: actorData } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_initials')
        .in('id', uniqueActorIds);
      actorMap = Object.fromEntries((actorData ?? []).map((a) => [a.id, a]));
    }

    // Step 4 — senti questions
    const sentiIds = [...new Set(notifs.filter((n) => n.senti_id).map((n) => n.senti_id))];
    let sentiMap = {};
    if (sentiIds.length) {
      const { data: sentiData } = await supabase.from('sentis').select('id, question').in('id', sentiIds);
      sentiMap = Object.fromEntries((sentiData ?? []).map((s) => [s.id, s]));
    }

    // Step 5 — reaction types for react notifications
    let reactionMap = {};
    const reactNotifs = notifs.filter((n) => n.type === 'react');
    if (reactNotifs.length) {
      const reactSentiIds = [...new Set(reactNotifs.map((n) => n.senti_id).filter(Boolean))];
      const reactActorIds = [...new Set(reactNotifs.map((n) => n.actor_id).filter(Boolean))];
      if (reactSentiIds.length && reactActorIds.length) {
        const { data: rxData } = await supabase
          .from('senti_reactions')
          .select('senti_id, user_id, reaction')
          .in('senti_id', reactSentiIds)
          .in('user_id', reactActorIds);
        reactionMap = Object.fromEntries((rxData ?? []).map((r) => [`${r.senti_id}_${r.user_id}`, r.reaction]));
      }
    }

    // Step 6 — assemble
    const assembled = notifs.map((n) => ({
      ...n,
      actor:         actorMap[n.actor_id],
      sentiQuestion: sentiMap?.[n.senti_id]?.question ?? null,
      reaction:      reactionMap?.[`${n.senti_id}_${n.actor_id}`] ?? null,
    }));
    setNotifications(assembled);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Realtime: rebuild the enriched list on new notifications.
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`notif-list-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
        () => fetchNotifications()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, fetchNotifications]);

  // Delegates to the context (single source of truth for unread), then updates
  // the rendered list's flags for immediate visual consistency.
  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  // Shared text logic (matches the toast exactly — see notificationText.js)
  const renderText = (n) => {
    const unread = !n.is_read;
    const baseColor = unread ? C.textPrimary : C.textSecondary;
    const weightFamily = unread ? F.semiBold : F.regular;
    const { prefix, reaction, suffix } = getNotificationLine(n);
    return (
      <Text style={[st.lineText, { color: baseColor, fontFamily: weightFamily }]}>
        {prefix}
        {reaction
          ? <Text style={{ color: getReactionColor(reaction, C), fontFamily: F.bold }}>{reactionLabel(reaction)}</Text>
          : null}
        {suffix}
      </Text>
    );
  };

  const renderItem = ({ item: n }) => {
    const av = AVATAR_STYLE[n.type] ?? AVATAR_STYLE.react;
    const unread = !n.is_read;
    return (
      <TouchableOpacity
        style={[st.item, unread ? st.itemUnread : st.itemRead]}
        onPress={() => navigateToNotification(n)}
        activeOpacity={0.7}
      >
        <View style={[st.avatar, { backgroundColor: av.bg }]}>
          <Text style={[st.avatarText, { color: av.fg }]}>{initialsOf(n.actor, n.type)}</Text>
        </View>
        <View style={st.content}>
          {renderText(n)}
          {n.sentiQuestion && n.type !== 'follow' && (
            <Text style={st.preview} numberOfLines={1}>
              "{n.sentiQuestion.slice(0, 40)}"
            </Text>
          )}
          <Text style={st.time}>{formatRelTime(n.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const anyUnread = notifications.some((n) => !n.is_read);

  return (
    <View style={st.screen}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="ti-chevron-left" size={fs(22)} color={C.textPrimary} />
          <Text style={st.headerTitle}>Notifications</Text>
        </TouchableOpacity>
        {anyUnread && (
          <TouchableOpacity onPress={handleMarkAllRead} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
            <Text style={st.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={C.accent} /></View>
      ) : notifications.length === 0 ? (
        <View style={st.center}><Text style={st.empty}>No notifications yet</Text></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={st.listContent}
          showsVerticalScrollIndicator={false}
        />
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
  headerTitle: { letterSpacing: -0.2, fontSize: fs(18), fontFamily: F.extraBold, color: C.textPrimary },
  markAll:  { fontSize: fs(13), fontFamily: F.semiBold, color: C.textMuted },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:  { fontFamily: F.regular, fontSize: fs(14), color: C.textMuted },

  listContent: { paddingHorizontal: ms(12), paddingVertical: vs(6), gap: vs(4) },
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: ms(10),
    paddingVertical: vs(10), paddingHorizontal: ms(10),
  },
  itemUnread: { backgroundColor: C.surface, borderLeftWidth: 2, borderLeftColor: C.accent, borderRadius: ms(10) },
  itemRead:   {},
  avatar: { width: s(40), height: s(40), borderRadius: s(20), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { letterSpacing: -0.2, fontSize: fs(15), fontFamily: F.extraBold },
  content: { flex: 1, minWidth: 0 },
  lineText: { fontFamily: F.regular, fontSize: fs(14), lineHeight: fs(19) },
  preview:  { fontFamily: F.regular, fontSize: fs(12.5), color: C.textMuted, marginTop: vs(2) },
  time:     { fontFamily: F.regular, fontSize: fs(11), color: C.textMuted, marginTop: vs(2) },
});

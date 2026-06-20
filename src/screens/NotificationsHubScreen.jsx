// ─────────────────────────────────────────────
// Peolia — NotificationsHubScreen
// src/screens/NotificationsHubScreen.jsx
//
// Hub reached from the Profile notification icon. Shows a notifications entry
// (with live unread count) and a placeholder DM card. Tapping notifications
// opens the full list.
//
// Props: onBack, onOpenList
// ─────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import Icon from '../components/Icon';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s } from '../utils/peoliaScale';

export default function NotificationsHubScreen({ onBack, onOpenList }) {
  const scheme = usePeoliaScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);

  // Single source of truth — owned by NotificationContext.
  const { unreadCount } = useNotifications();

  return (
    <View style={st.screen}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="ti-chevron-left" size={fs(22)} color={C.textPrimary} />
          <Text style={st.headerTitle}>Notifications</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications pill */}
      <TouchableOpacity style={[st.card, st.cardAccent]} onPress={onOpenList} activeOpacity={0.85}>
        <View style={[st.iconCircle, { backgroundColor: C.accentLight }]}>
          <Icon name="ti-bell" size={fs(16)} color={C.accent} />
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
          <Icon name="ti-chevron-right" size={fs(13)} color={C.textMuted} />
        </View>
      </TouchableOpacity>

      {/* DM placeholder */}
      <View style={[st.card, st.cardPlain]}>
        <View style={[st.iconCircle, { backgroundColor: C.surfaceAlt }]}>
          <Icon name="ti-message-2" size={fs(16)} color={C.textMuted} />
        </View>
        <View style={st.cardMid}>
          <Text style={st.dmTitle}>No messages yet</Text>
          <Text style={st.dmSub}>Direct messages coming soon</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: ms(14), paddingTop: vs(10), paddingBottom: vs(8),
  },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  headerTitle: { fontSize: fs(18), fontWeight: '800', color: C.textPrimary },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: ms(9),
    marginHorizontal: ms(12), marginTop: vs(4),
    backgroundColor: C.surface, borderRadius: ms(13),
    paddingVertical: vs(11), paddingHorizontal: ms(12),
  },
  cardAccent: { borderWidth: 0.5, borderColor: C.accent },
  cardPlain:  { borderWidth: 0.5, borderColor: C.border },
  iconCircle: { width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center' },
  cardMid:    { flex: 1 },
  cardTitle:  { fontSize: fs(10), fontWeight: '800', color: C.textPrimary },
  cardSub:    { fontSize: fs(7), color: C.textSecondary, marginTop: vs(1) },
  cardRight:  { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  badge:      { backgroundColor: C.accent, borderRadius: ms(12), paddingVertical: vs(2), paddingHorizontal: ms(7) },
  badgeText:  { fontSize: fs(8), color: '#FFFFFF', fontWeight: '800' },

  dmTitle: { fontSize: fs(9.5), fontWeight: '600', color: C.textMuted },
  dmSub:   { fontSize: fs(7), color: C.textMuted, marginTop: vs(1) },
});

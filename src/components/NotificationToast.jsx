// ─────────────────────────────────────────────
// Peolia — NotificationToast
// src/components/NotificationToast.jsx
//
// Top slide-in toast for a single incoming notification. Auto-dismisses after
// 4s; tapping calls onPress (the parent's onPress handles navigate + dismiss).
//
// Props: notification (enriched object | null), onDismiss, onPress
// ─────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePeoliaScheme } from '../context/ThemeContext';

import { fs, ms, vs, s } from '../utils/peoliaScale';
import { getNotificationLine, getReactionColor, reactionLabel } from '../utils/notificationText';

const AUTO_DISMISS_MS = 4000;

export default function NotificationToast({ notification, onDismiss, onPress }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const insets = useSafeAreaInsets();
  const st = makeStyles(C);

  const translateY = useRef(new Animated.Value(-120)).current;

  // Slide in + arm the auto-dismiss timer whenever a new notification appears.
  useEffect(() => {
    if (!notification) return;

    translateY.setValue(-120);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => { onDismiss?.(); }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // Re-run (reset timer + re-animate) when the shown notification changes.
  }, [notification?.id]);

  if (!notification) return null;

  const { prefix, reaction, suffix } = getNotificationLine(notification);
  const actor = notification.actor;
  const initials =
    notification.type === 'warning'
      ? '!'   // no actor for warnings — actor_id is null
      : (actor?.avatar_initials && actor.avatar_initials !== '??'
          ? actor.avatar_initials
          : actor?.display_name?.[0] ?? actor?.username?.[0] ?? '?'
        ).toUpperCase();

  const AVATAR_BG = {
    react:   C.accentLight,
    voice:   C.yesBg,
    reply:   C.nahBg,
    follow:  C.yesBg,
    warning: C.nahBg,
  };
  const avatarBg = AVATAR_BG[notification.type] ?? C.accentLight;
  const showPreview = notification.sentiQuestion && notification.type !== 'follow';

  return (
    <Animated.View
      style={[st.wrap, { top: insets.top + vs(8), transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity style={st.card} onPress={onPress} activeOpacity={0.85}>
        <View style={[st.avatar, { backgroundColor: avatarBg }]}>
          <Text style={st.avatarText}>{initials}</Text>
        </View>
        <View style={st.content}>
          <Text style={st.line} numberOfLines={2}>
            <Text>{prefix}</Text>
            {reaction && (
              <Text style={{ color: getReactionColor(reaction, C), fontFamily: F.extraBold }}>
                {reactionLabel(reaction)}
              </Text>
            )}
            <Text>{suffix}</Text>
          </Text>
          {showPreview && (
            <Text style={st.preview} numberOfLines={1}>
              "{notification.sentiQuestion.slice(0, 40)}"
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: ms(12),
    right: ms(12),
    zIndex: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    backgroundColor: C.sheetBg,
    borderWidth: 0.5,
    borderColor: C.sheetBorder,
    borderRadius: ms(13),
    paddingVertical: vs(10),
    paddingHorizontal: ms(11),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  avatar: {
    width: s(30), height: s(30), borderRadius: s(15),
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: fs(11), fontFamily: F.extraBold, color: C.textPrimary },
  content: { flex: 1, minWidth: 0 },
  line: { fontSize: fs(9), fontFamily: F.semiBold, color: C.textPrimary, lineHeight: fs(13) },
  preview: { fontFamily: F.regular, fontSize: fs(7.5), color: C.textMuted, marginTop: vs(1) },
});

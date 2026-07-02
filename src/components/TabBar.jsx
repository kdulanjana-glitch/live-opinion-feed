// ─────────────────────────────────────────────
// Peolia — TabBar (Scaled for real devices)
// src/components/TabBar.jsx
// ─────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';

import { fs, ms, vs, s } from '../utils/peoliaScale';

const TABS = [
  { key: 'trending',  label: 'Trending',  icon: '↗'  },
  { key: 'float',     label: 'Float',     icon: '+'   },
  { key: 'sentarium', label: 'Sentarium', icon: '⌂'  },
  { key: 'pin',       label: 'Pin',       icon: '📌' },
  { key: 'profile',   label: 'Profile',   icon: '◯'  },
];

export default function TabBar({ activeTab, onTabPress }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const { unreadCount, dmUnreadTotal } = useNotifications();
  const totalBadge = (unreadCount || 0) + (dmUnreadTotal || 0);

  return (
    <View style={st.wrapper}>
      <View style={st.pill}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[st.tab, isActive && st.tabActive]}
              onPress={() => onTabPress(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[st.icon, isActive && st.iconActive]}>{tab.icon}</Text>
              <Text style={[st.label, isActive && st.labelActive]}>{tab.label}</Text>
              {tab.key === 'profile' && totalBadge > 0 && (
                <View style={st.badge}>
                  <Text style={st.badgeText}>{totalBadge > 99 ? '99+' : totalBadge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  wrapper: {
    paddingHorizontal: ms(10),
    paddingTop: vs(6),
    paddingBottom: vs(12),
    backgroundColor: C.bg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.tabBg,
    borderRadius: ms(28),
    borderWidth: 0.5,
    borderColor: C.tabBorder,
    paddingVertical: vs(6),
    paddingHorizontal: ms(4),
  },
  tab: {
    position: 'relative',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(2),
    paddingVertical: vs(5),
    paddingHorizontal: ms(8),
    borderRadius: ms(18),
    minWidth: ms(44),
  },
  badge: {
    position: 'absolute', top: vs(2), right: ms(4),
    minWidth: s(14), height: s(14), borderRadius: s(7),
    backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: C.tabBg,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: ms(2),
  },
  badgeText: { fontSize: fs(7), color: '#FFFFFF', fontFamily: F.extraBold },
  tabActive:   { backgroundColor: C.tabActive },
  icon:        { fontFamily: F.regular, fontSize: fs(20), color: C.tabInactive },
  iconActive:  { color: '#FFFFFF' },
  label:       { fontSize: fs(13), fontFamily: F.bold, color: C.tabInactive },
  labelActive: { color: '#FFFFFF' },
});

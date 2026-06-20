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
import { usePeoliaScheme } from '../context/ThemeContext';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs } from '../utils/peoliaScale';

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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(2),
    paddingVertical: vs(5),
    paddingHorizontal: ms(8),
    borderRadius: ms(18),
    minWidth: ms(44),
  },
  tabActive:   { backgroundColor: C.tabActive },
  icon:        { fontSize: fs(20), color: C.tabInactive },
  iconActive:  { color: '#FFFFFF' },
  label:       { fontSize: fs(13), fontWeight: '700', color: C.tabInactive },
  labelActive: { color: '#FFFFFF' },
});

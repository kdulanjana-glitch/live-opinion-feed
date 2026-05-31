// ─────────────────────────────────────────────
// Peolia — TabBar Component
// src/components/TabBar.jsx
//
// Usage:
//   <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
//
// Tab keys: 'trending' | 'float' | 'sentarium' | 'pin' | 'profile'
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { getPeoliaColors, PeoliaSpacing } from '../constants/peoliaTheme';

const TABS = [
  { key: 'trending',  label: 'Trending',  icon: '↗'  },
  { key: 'float',     label: 'Float',     icon: '+'   },
  { key: 'sentarium', label: 'Sentarium', icon: '⌂'  },
  { key: 'pin',       label: 'Pin',       icon: '📌' },
  { key: 'profile',   label: 'Profile',   icon: '◯'  },
];

export default function TabBar({ activeTab, onTabPress }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C);

  return (
    <View style={s.wrapper}>
      <View style={s.pill}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, isActive && s.tabActive]}
              onPress={() => onTabPress(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.icon, isActive && s.iconActive]}>
                {tab.icon}
              </Text>
              <Text style={[s.label, isActive && s.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  wrapper: {
    paddingHorizontal: 8,
    paddingTop: 5,
    paddingBottom: 10,
    backgroundColor: C.bg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.tabBg,
    borderRadius: PeoliaSpacing.tabBarRadius,
    borderWidth: 0.5,
    borderColor: C.tabBorder,
    paddingVertical: 5,
    paddingHorizontal: 3,
  },
  tab: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: PeoliaSpacing.tabItemRadius,
    minWidth: 36,
  },
  tabActive: {
    backgroundColor: C.tabActive,
  },
  icon: {
    fontSize: 15,
    color: C.tabInactive,
  },
  iconActive: {
    color: '#FFFFFF',
  },
  label: {
    fontSize: 6.5,
    fontWeight: '700',
    color: C.tabInactive,
  },
  labelActive: {
    color: '#FFFFFF',
  },
});

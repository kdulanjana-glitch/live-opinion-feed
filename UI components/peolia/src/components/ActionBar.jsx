// ─────────────────────────────────────────────
// Peolia — ActionBar Component
// src/components/ActionBar.jsx
//
// The vertical right-side action bar on the feed card.
//
// Usage:
//   <ActionBar
//     likes={24000}
//     voices={1200}
//     pins={8400}
//     onLike={handleLike}
//     onVoice={handleVoice}
//     onPin={handlePin}
//     onAsk={handleAsk}
//     transparent={false}  // true = on image (white icons)
//   />
// ─────────────────────────────────────────────

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useColorScheme,
} from 'react-native';
import { getPeoliaColors } from '../constants/peoliaTheme';

// Format large numbers: 24000 → "24K", 1400000 → "1.4M"
const formatCount = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

// Minimal SVG-like icons rendered as Unicode / Text
// Replace with real SVG components once icon library is added
const HeartIcon  = ({ color }) => <Text style={{ fontSize: 20, color }}>♥</Text>;
const ChatIcon   = ({ color }) => <Text style={{ fontSize: 18, color }}>💬</Text>;
const PinIcon    = ({ color }) => <Text style={{ fontSize: 18, color }}>🔖</Text>;
const AskIcon    = ({ color }) => <Text style={{ fontSize: 18, color }}>🙋</Text>;

export default function ActionBar({
  likes    = 0,
  voices   = 0,
  pins     = 0,
  onLike,
  onVoice,
  onPin,
  onAsk,
  transparent = false,
}) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C, transparent);

  const iconColor  = transparent ? 'rgba(255,255,255,0.45)' : C.iconMuted;
  const countColor = transparent ? 'rgba(255,255,255,0.55)' : C.textMuted;

  const items = [
    { Icon: HeartIcon, color: '#F87171', count: formatCount(likes),  onPress: onLike  },
    { Icon: ChatIcon,  color: iconColor, count: formatCount(voices), onPress: onVoice },
    { Icon: PinIcon,   color: iconColor, count: formatCount(pins),   onPress: onPin   },
    { Icon: AskIcon,   color: iconColor, count: 'Ask',               onPress: onAsk   },
  ];

  return (
    <View style={s.bar}>
      {items.map(({ Icon, color, count, onPress }, i) => (
        <TouchableOpacity
          key={i}
          style={s.item}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <Icon color={color} />
          <Text style={[s.count, { color: countColor }]}>{count}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (C, transparent) => StyleSheet.create({
  bar: {
    width: 42,
    flexShrink: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingRight: 6,
  },
  item: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  count: {
    fontSize: 8,
    fontWeight: '600',
  },
});

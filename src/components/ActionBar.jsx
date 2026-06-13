// ─────────────────────────────────────────────
// Peolia — ActionBar (Scaled for real devices)
// src/components/ActionBar.jsx
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, s, vs } from '../utils/peoliaScale';

const formatCount = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

// Icons — all sizes increased 25% (×1.25)
const HeartIcon    = ({ color }) => <Text style={{ fontSize: fs(30), color }}>♥</Text>;
const ChatIcon     = ({ color }) => <Text style={{ fontSize: fs(28), color }}>💬</Text>;
const BookmarkIcon = ({ color }) => <Text style={{ fontSize: fs(28), color }}>🔖</Text>; // not pinned
const PushpinIcon  = ({ color }) => <Text style={{ fontSize: fs(28), color }}>📌</Text>; // pinned
const AskIcon      = ({ color }) => <Text style={{ fontSize: fs(28), color }}>🙋</Text>;

export default function ActionBar({
  likes  = 0,
  voices = 0,
  pins   = 0,
  liked  = false,   // true → heart red
  pinned = false,   // true → pushpin accent, false → bookmark grey
  onImage = false,  // true → card has full-bleed image; use light icon/count colors
  onLike,
  onVoice,
  onPin,
  onAsk,
}) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const mutedColor = onImage ? 'rgba(255,255,255,0.85)' : C.iconMuted;

  const items = [
    {
      Icon:    HeartIcon,
      color:   liked  ? C.likeColor : mutedColor,
      count:   formatCount(likes),
      onPress: onLike,
    },
    {
      Icon:    ChatIcon,
      color:   mutedColor,
      count:   formatCount(voices),
      onPress: onVoice,
    },
    {
      // Distinct icon AND colour change: 📌 (pinned) vs 🔖 (not pinned)
      Icon:    pinned ? PushpinIcon : BookmarkIcon,
      color:   pinned ? C.accent    : mutedColor,
      count:   formatCount(pins),
      onPress: onPin,
    },
    {
      Icon:    AskIcon,
      color:   mutedColor,
      count:   'Ask',
      onPress: onAsk,
    },
  ];

  return (
    <View style={st.bar}>
      {items.map(({ Icon, color, count, onPress }, i) => (
        <TouchableOpacity key={i} style={st.item} onPress={onPress} activeOpacity={0.7}>
          <Icon color={color} />
          <Text style={[st.count, onImage && st.countOnImage]}>{count}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  bar: {
    width: s(62),          // slightly wider to fit larger icons
    flexShrink: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(18),           // a touch more breathing room
    paddingRight: ms(8),
  },
  item: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: vs(3),
  },
  count: {
    fontSize: fs(18),      // was fs(14), now ×1.25
    fontWeight: '600',
    color: C.textMuted,
  },
  countOnImage: { color: 'rgba(255,255,255,0.85)' },
});

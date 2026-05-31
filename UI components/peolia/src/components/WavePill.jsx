// ─────────────────────────────────────────────
// Peolia — WavePill Component
// src/components/WavePill.jsx
//
// Usage:
//   <WavePill wave="Tech" />
//   <WavePill wave="Love" transparent /> // for use on dark image bg
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { getPeoliaColors } from '../constants/peoliaTheme';

const WAVE_EMOJIS = {
  'Tech':          '💻',
  'Love':          '❤️',
  'Money':         '💰',
  'Life':          '🌱',
  'Society':       '🌍',
  'Politics':      '🏛️',
  'Food':          '🍕',
  'Health':        '💪',
  'Sports':        '⚽',
  'Entertainment': '🎬',
  'Science':       '🔬',
  'Education':     '📚',
  'Environment':   '🌿',
};

export default function WavePill({ wave = 'Tech', transparent = false, style }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const emoji = WAVE_EMOJIS[wave] || '🌊';

  const pillStyle = transparent
    ? { backgroundColor: 'rgba(255,255,255,0.18)' }
    : { backgroundColor: C.accentLight };

  const textStyle = transparent
    ? { color: '#FFFFFF' }
    : { color: C.accentDark };

  return (
    <View style={[styles.pill, pillStyle, style]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, textStyle]}>{wave.toUpperCase()} WAVE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  emoji: {
    fontSize: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

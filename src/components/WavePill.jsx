// ─────────────────────────────────────────────
// Peolia — WavePill (Scaled for real devices)
// src/components/WavePill.jsx
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs } from '../utils/peoliaScale';

const WAVE_EMOJIS = {
  'Tech': '💻', 'Love': '❤️', 'Money': '💰', 'Life': '🌱',
  'Society': '🌍', 'Politics': '🏛️', 'Food': '🍕', 'Health': '💪',
  'Sports': '⚽', 'Entertainment': '🎬', 'Science': '🔬',
  'Education': '📚', 'Environment': '🌿',
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
    gap: ms(5),
    paddingVertical: vs(5),
    paddingHorizontal: ms(14),
    borderRadius: ms(20),
    alignSelf: 'flex-start',
  },
  emoji: { fontSize: fs(15) },
  label: { fontSize: fs(18), fontWeight: '700', letterSpacing: 0.4 },  // was fs(14) → ×1.25
});

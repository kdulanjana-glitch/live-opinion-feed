// ─────────────────────────────────────────────
// Peolia — SentiTile
// src/components/SentiTile.jsx
//
// A 9:16 grid tile for a senti. Shows the senti's image (image_url) as a
// full-bleed background, or — when there's no image — a solid colour tied to
// the wave. Used by the Profile "Floated sentis" grid and the Pin grid.
//
// Props: senti { id, question, wave, imageUrl }, width, onPress, onUnpin?
// Height is derived as width * 16/9. Pass onUnpin to show a pin button (Pin grid).
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, useColorScheme } from 'react-native';
import { getPeoliaColors, WaveColors } from '../constants/peoliaTheme';
import { fs, ms, vs } from '../utils/peoliaScale';

const WAVE_EMOJIS = {
  'Tech': '💻', 'Love': '❤️', 'Money': '💰', 'Life': '🌱',
  'Society': '🌍', 'Politics': '🏛️', 'Food': '🍕', 'Health': '💪',
  'Sports': '⚽', 'Entertainment': '🎬', 'Science': '🔬',
  'Education': '📚', 'Environment': '🌿',
};

export default function SentiTile({ senti, width, onPress, onUnpin }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const height   = Math.round((width * 16) / 9);   // 9:16 portrait
  const wave     = senti?.wave ?? 'Tech';
  const hasImage = !!senti?.imageUrl;
  const bg       = (WaveColors[wave] ?? WaveColors.default)[0];  // darker wave colour
  const emoji    = WAVE_EMOJIS[wave] ?? '🌊';

  return (
    <TouchableOpacity
      style={[st.tile, { width, height, backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {hasImage ? (
        <>
          <Image source={{ uri: senti.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={st.overlayStrong} />
        </>
      ) : (
        <View style={st.overlaySoft} />
      )}

      <View style={st.content}>
        <View style={st.topRow}>
          <View style={st.wavePill}>
            <Text style={st.wavePillText} numberOfLines={1}>{emoji} {wave.toUpperCase()}</Text>
          </View>
          {onUnpin && (
            <TouchableOpacity
              style={st.unpinBtn}
              onPress={onUnpin}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={st.unpinIcon}>📌</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={st.question} numberOfLines={5}>{senti?.question}</Text>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (C) => StyleSheet.create({
  tile: { borderRadius: ms(14), overflow: 'hidden' },
  overlayStrong: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  overlaySoft:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.16)' },
  content: { flex: 1, padding: ms(12), justifyContent: 'space-between' },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  wavePill: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: ms(20), paddingVertical: vs(4), paddingHorizontal: ms(10),
    alignSelf: 'flex-start', maxWidth: '82%',
  },
  wavePillText: { fontSize: fs(12), fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  unpinBtn: {
    width: ms(30), height: ms(30), borderRadius: ms(15),
    backgroundColor: 'rgba(0,0,0,0.40)', alignItems: 'center', justifyContent: 'center',
  },
  unpinIcon: { fontSize: fs(15) },
  question:  { fontSize: fs(17), fontWeight: '800', color: '#FFFFFF', lineHeight: fs(22) },
});

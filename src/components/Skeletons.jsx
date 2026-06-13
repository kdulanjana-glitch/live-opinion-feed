// ─────────────────────────────────────────────
// Peolia — Skeletons
// src/components/Skeletons.jsx
//
// Static placeholder shapes (C.surfaceAlt) that mimic real content while
// loading. No shimmer for now. Exports:
//   FeedSkeleton      — one full-screen SentiCard placeholder (Sentarium)
//   TrendingSkeleton  — 3 stacked list-item placeholders (Trending)
//   GridSkeleton      — N tiles in a grid (Pin / Profile floated grid)
// ─────────────────────────────────────────────

import React from 'react';
import { View, StyleSheet, useColorScheme, StatusBar, Platform } from 'react-native';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { ms, vs, s, SCREEN_WIDTH } from '../utils/peoliaScale';

// ── Full-screen feed card placeholder ─────────
export function FeedSkeleton() {
  const C = getPeoliaColors(useColorScheme());
  const st = feedStyles(C);
  return (
    <View style={st.screen}>
      {/* top row: wave pill + avatar */}
      <View style={st.topRow}>
        <View style={st.pill} />
        <View style={st.avatar} />
      </View>

      {/* question + description lines */}
      <View style={st.middle}>
        <View style={[st.bar, st.qLine, { width: '92%' }]} />
        <View style={[st.bar, st.qLine, { width: '66%' }]} />
        <View style={[st.bar, st.dLine, { width: '96%', marginTop: vs(14) }]} />
        <View style={[st.bar, st.dLine, { width: '88%' }]} />
        <View style={[st.bar, st.dLine, { width: '72%' }]} />
      </View>

      {/* 3 vote button placeholders */}
      <View style={st.voteRow}>
        <View style={st.voteBtn} />
        <View style={st.voteBtn} />
        <View style={st.voteBtn} />
      </View>
    </View>
  );
}

// ── 3 stacked Trending card placeholders ──────
export function TrendingSkeleton() {
  const C = getPeoliaColors(useColorScheme());
  const st = trendStyles(C);
  return (
    <View style={st.list}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={st.card}>
          <View style={st.block} />
          <View style={st.footer}>
            <View style={st.fpill} />
            <View style={st.fbar} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Grid of tile placeholders (9:16) ──────────
export function GridSkeleton({ columns = 2, count = 6, paddingHorizontal = ms(16), gap = ms(8) }) {
  const C = getPeoliaColors(useColorScheme());
  const st = gridStyles(C);
  const tileW = Math.floor((SCREEN_WIDTH - paddingHorizontal * 2 - gap * (columns - 1)) / columns);
  const tileH = Math.round((tileW * 16) / 9);
  return (
    <View style={[st.grid, { paddingHorizontal, gap }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[st.tile, { width: tileW, height: tileH }]} />
      ))}
    </View>
  );
}

const feedStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
    paddingHorizontal: ms(16),
    paddingBottom: vs(16),
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingTop: vs(10),
  },
  pill:   { width: ms(120), height: vs(26), borderRadius: ms(20), backgroundColor: C.surfaceAlt },
  avatar: { width: s(40), height: s(40), borderRadius: s(20), backgroundColor: C.surfaceAlt },
  middle: { flex: 1, paddingTop: vs(18) },
  bar:    { backgroundColor: C.surfaceAlt, borderRadius: ms(8), marginBottom: vs(8) },
  qLine:  { height: vs(26) },
  dLine:  { height: vs(14) },
  voteRow:  { flexDirection: 'row', gap: ms(6) },
  voteBtn:  { flex: 1, height: vs(52), borderRadius: ms(14), backgroundColor: C.surfaceAlt },
});

const trendStyles = (C) => StyleSheet.create({
  list: { paddingHorizontal: ms(14), paddingTop: vs(10), gap: vs(8) },
  card: { borderRadius: ms(14), borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
  block:  { height: vs(70), backgroundColor: C.surfaceAlt },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: ms(12), paddingVertical: vs(8),
  },
  fpill: { width: ms(70), height: vs(18), borderRadius: ms(20), backgroundColor: C.surfaceAlt },
  fbar:  { width: ms(90), height: vs(12), borderRadius: ms(6), backgroundColor: C.surfaceAlt },
});

const gridStyles = (C) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: vs(12) },
  tile: { borderRadius: ms(14), backgroundColor: C.surfaceAlt },
});

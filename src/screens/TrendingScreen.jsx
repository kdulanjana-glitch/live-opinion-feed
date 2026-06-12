// ─────────────────────────────────────────────
// Peolia — TrendingScreen
// src/screens/TrendingScreen.jsx
//
// Queries: trending_sentis view (ordered by velocity_2h desc)
// Wave filter: passed as .eq('wave', activeWave) to the view
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ScrollView, StyleSheet, useColorScheme,
  ActivityIndicator, StatusBar, Platform, RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs } from '../utils/peoliaScale';

const ALL_WAVES = [
  'All', 'Tech', 'Love', 'Money', 'Life', 'Society',
  'Politics', 'Food', 'Health', 'Sports',
  'Entertainment', 'Science', 'Education', 'Environment',
];

const WAVE_EMOJIS = {
  'Tech': '💻', 'Love': '❤️', 'Money': '💰', 'Life': '🌱',
  'Society': '🌍', 'Politics': '🏛️', 'Food': '🍕', 'Health': '💪',
  'Sports': '⚽', 'Entertainment': '🎬', 'Science': '🔬',
  'Education': '📚', 'Environment': '🌿',
};

const WAVE_GRADIENTS = {
  'Tech': '#1E1B4B', 'Love': '#831843', 'Money': '#78350F',
  'Life': '#134E4A', 'Society': '#1F2937', 'Politics': '#7F1D1D',
  'Food': '#7C2D12', 'Health': '#064E3B', 'Sports': '#1E3A5F',
  'Entertainment': '#3B0764', 'Science': '#0C4A6E',
  'Education': '#1A2E05', 'Environment': '#064E3B',
};

const formatCount = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

export default function TrendingScreen({ onOpenSenti }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C);

  const [sentis,     setSentis]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeWave, setActiveWave] = useState('All');

  // Query trending_sentis view — pass wave filter directly to Supabase
  const fetchTrending = useCallback(async (wave = 'All') => {
    try {
      let query = supabase
        .from('trending_sentis')
        .select('id, question, wave, total_reacts, velocity_2h')
        .order('velocity_2h', { ascending: false })
        .limit(20);

      if (wave !== 'All') {
        query = query.eq('wave', wave);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSentis(data ?? []);
    } catch (err) {
      console.error('TrendingScreen fetchTrending error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTrending(activeWave);
  }, [activeWave, fetchTrending]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTrending(activeWave);
  };

  const handleWaveChange = (wave) => {
    setActiveWave(wave);
    setLoading(true);
    setSentis([]);
  };

  const renderCard = ({ item, index }) => {
    const rank     = index + 1;
    const wave     = item.wave ?? 'Tech';
    const bgColor  = WAVE_GRADIENTS[wave] ?? '#1E1B4B';
    const emoji    = WAVE_EMOJIS[wave] ?? '🌊';
    const isFirst  = rank === 1;

    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: C.surface }]}
        onPress={() => onOpenSenti?.(item.id)}
        activeOpacity={0.8}
      >
        {/* Coloured header with rank + question */}
        <View style={[s.cardImg, { backgroundColor: bgColor, height: isFirst ? vs(80) : vs(66) }]}>
          <View style={s.overlay} />
          <View style={[s.rankBadge, rank === 1 ? s.rankBadge1 : s.rankBadgeN]}>
            <Text style={s.rankText}>#{rank}</Text>
          </View>
          <Text style={s.cardQuestion} numberOfLines={2}>{item.question}</Text>
        </View>

        {/* Footer: wave pill + react count + velocity */}
        <View style={s.cardFooter}>
          <View style={s.cardLeft}>
            <View style={[s.wavePillSmall, { backgroundColor: C.accentLight }]}>
              <Text style={s.wavePillText}>{emoji} {wave}</Text>
            </View>
            <Text style={s.reactCount}>{formatCount(item.total_reacts)} reacts</Text>
          </View>
          <Text style={[s.velocity, { color: C.velocity }]}>
            ↑ {formatCount(item.velocity_2h)} in 2hrs
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.screen}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Trending</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>Top 20 today</Text>
        </View>
      </View>

      {/* Wave filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={s.filterContent}
      >
        {ALL_WAVES.map((wave) => {
          const isActive = activeWave === wave;
          const label    = wave === 'All' ? 'All waves'
                         : `${WAVE_EMOJIS[wave] ?? ''} ${wave}`;
          return (
            <TouchableOpacity
              key={wave}
              style={[
                s.filterPill,
                isActive
                  ? { backgroundColor: C.accent }
                  : { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border },
              ]}
              onPress={() => handleWaveChange(wave)}
              activeOpacity={0.7}
            >
              <Text style={[s.filterText, { color: isActive ? '#FFFFFF' : C.textMuted }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List / empty / loading */}
      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : sentis.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🌊</Text>
          <Text style={[s.emptyText, { color: C.textSecondary }]}>
            No trending sentis{activeWave !== 'All' ? ` in ${activeWave}` : ''} yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sentis}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />
          }
        />
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: ms(16),
    paddingTop: vs(10), paddingBottom: 0,
  },
  title:         { fontSize: fs(17), fontWeight: '800', color: C.textPrimary },
  badge: {
    backgroundColor: C.surfaceAlt, borderRadius: ms(20),
    paddingVertical: vs(4), paddingHorizontal: ms(10),
    borderWidth: 0.5, borderColor: C.border,
  },
  badgeText:     { fontSize: fs(12), fontWeight: '600', color: C.textMuted },
  filterScroll:  { marginTop: vs(10), flexGrow: 0 },
  filterContent: { paddingHorizontal: ms(16), gap: ms(6), paddingBottom: vs(4) },
  filterPill:    { paddingVertical: vs(5), paddingHorizontal: ms(13), borderRadius: ms(20) },
  filterText:    { fontSize: fs(13), fontWeight: '700' },
  list:          { paddingHorizontal: ms(14), paddingTop: vs(10), gap: vs(8), paddingBottom: vs(20) },
  card:          { borderRadius: ms(14), borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
  cardImg:       { position: 'relative', justifyContent: 'flex-end', padding: ms(10) },
  overlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  rankBadge: {
    position: 'absolute', top: ms(10), left: ms(10),
    borderRadius: ms(8), paddingVertical: vs(3), paddingHorizontal: ms(8),
  },
  rankBadge1:    { backgroundColor: '#4F46E5' },
  rankBadgeN:    { backgroundColor: 'rgba(255,255,255,0.2)' },
  rankText:      { fontSize: fs(13), fontWeight: '800', color: '#FFFFFF' },
  cardQuestion: {
    fontSize: fs(14), fontWeight: '800', color: '#FFFFFF',
    lineHeight: fs(19), position: 'relative', zIndex: 1,
  },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: ms(12), paddingVertical: vs(8),
  },
  cardLeft:      { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  wavePillSmall: { paddingVertical: vs(3), paddingHorizontal: ms(8), borderRadius: ms(20) },
  wavePillText:  { fontSize: fs(12), fontWeight: '700', color: '#4338CA' },
  reactCount:    { fontSize: fs(12), fontWeight: '600', color: C.textMuted },
  velocity:      { fontSize: fs(12), fontWeight: '700' },
  loader:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ms(32) },
  emptyIcon:     { fontSize: fs(40), marginBottom: vs(12) },
  emptyText:     { fontSize: fs(15), fontWeight: '600', textAlign: 'center' },
});

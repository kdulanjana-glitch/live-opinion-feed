// ─────────────────────────────────────────────
// Peolia — TrendingScreen
// src/screens/TrendingScreen.jsx
//
// Scrollable list of top 20 trending sentis.
// Wave filter pills at top. Rank + velocity on each card.
// Tap a card to open it in Sentarium.
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ScrollView, StyleSheet, useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';

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

// Wave gradient colors for card backgrounds
const WAVE_GRADIENTS = {
  'Tech': '#1E1B4B', 'Love': '#831843', 'Money': '#78350F',
  'Life': '#134E4A', 'Society': '#1F2937', 'Politics': '#7F1D1D',
  'Food': '#7C2D12', 'Health': '#064E3B', 'Sports': '#1E3A5F',
  'Entertainment': '#3B0764', 'Science': '#0C4A6E',
  'Education': '#1A2E05', 'Environment': '#064E3B',
};

export default function TrendingScreen({ onOpenSenti }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C);

  const [sentis,       setSentis]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeWave,   setActiveWave]   = useState('All');

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('sentis')
        .select(`
          id, question, wave,
          senti_counts(total_reacts, velocity_2h)
        `)
        .eq('status', 'approved')
        .order('velocity_2h', { ascending: false, foreignTable: 'senti_counts' })
        .limit(20);

      if (activeWave !== 'All') {
        query = query.eq('wave', activeWave);
      }

      const { data, error } = await query;
      if (error) throw error;

      setSentis(data ?? []);
    } catch (err) {
      console.error('TrendingScreen fetchTrending error', err);
    } finally {
      setLoading(false);
    }
  }, [activeWave]);

  useEffect(() => { fetchTrending(); }, [fetchTrending]);

  const renderCard = ({ item, index }) => {
    const rank     = index + 1;
    const counts   = item.senti_counts?.[0] ?? {};
    const total    = formatCount(counts.total_reacts ?? 0);
    const velocity = formatCount(counts.velocity_2h  ?? 0);
    const bgColor  = WAVE_GRADIENTS[item.wave] ?? '#1E1B4B';
    const emoji    = WAVE_EMOJIS[item.wave] ?? '🌊';
    const isFirst  = rank === 1;

    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: C.surface }]}
        onPress={() => onOpenSenti?.(item.id)}
        activeOpacity={0.8}
      >
        {/* Image header */}
        <View style={[s.cardImg, { backgroundColor: bgColor, height: isFirst ? 70 : 60 }]}>
          <View style={s.overlay} />
          {/* Rank badge */}
          <View style={[s.rankBadge, rank === 1 ? s.rankBadge1 : s.rankBadgeN]}>
            <Text style={s.rankText}>#{rank}</Text>
          </View>
          <Text style={s.cardQuestion} numberOfLines={2}>
            {item.question}
          </Text>
        </View>

        {/* Footer */}
        <View style={s.cardFooter}>
          <View style={s.cardLeft}>
            <View style={[s.wavePillSmall, { backgroundColor: C.accentLight }]}>
              <Text style={s.wavePillText}>
                {emoji} {item.wave}
              </Text>
            </View>
            <Text style={s.reactCount}>{total} reacts</Text>
          </View>
          <Text style={[s.velocity, { color: C.velocity }]}>
            ↑ {velocity} in 2hrs
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.screen}>

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
              onPress={() => setActiveWave(wave)}
              activeOpacity={0.7}
            >
              <Text style={[
                s.filterText,
                { color: isActive ? '#FFFFFF' : C.textMuted },
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <FlatList
          data={sentis}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const formatCount = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: C.textPrimary,
  },
  badge: {
    backgroundColor: C.surfaceAlt,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '600',
    color: C.textMuted,
  },
  filterScroll: {
    marginTop: 8,
    flexGrow: 0,
  },
  filterContent: {
    paddingHorizontal: 14,
    gap: 5,
    paddingBottom: 2,
  },
  filterPill: {
    paddingVertical: 4,
    paddingHorizontal: 11,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 9,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 6,
    paddingBottom: 16,
  },
  card: {
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: C.border,
    overflow: 'hidden',
  },
  cardImg: {
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  rankBadge1: {
    backgroundColor: '#4F46E5',
  },
  rankBadgeN: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  rankText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardQuestion: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 15,
    position: 'relative',
    zIndex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  wavePillSmall: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 20,
  },
  wavePillText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#4338CA',
  },
  reactCount: {
    fontSize: 8,
    fontWeight: '600',
    color: C.textMuted,
  },
  velocity: {
    fontSize: 8,
    fontWeight: '700',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

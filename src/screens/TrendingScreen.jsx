// ─────────────────────────────────────────────
// Peolia — TrendingScreen
// src/screens/TrendingScreen.jsx
//
// Queries: trending_sentis view (ordered by velocity_2h desc)
// Wave filter: passed as .eq('wave', activeWave) to the view
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  StatusBar,
  Platform,
  RefreshControl,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useBlocks } from '../context/BlockContext';
import { supabase } from '../lib/supabase';

import { fs, ms, vs, SCREEN_WIDTH } from '../utils/peoliaScale';
import SentiTile from '../components/SentiTile';
import EmptyState from '../components/EmptyState';
import { TrendingSkeleton } from '../components/Skeletons';

// avatar_initials is stale ('??') for legacy rows — fall back to a derived letter.
const leaderInitials = (u) => {
  const ai = u?.avatar_initials;
  if (ai && ai !== '??') return ai.toUpperCase();
  return (u?.display_name?.[0] ?? u?.username?.[0] ?? '?').toUpperCase();
};

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

// 2-column grid metrics (like Pin, but 2 per row)
const COLS   = 2;
const GAP    = ms(8);
const H_PAD  = ms(14);
const TILE_W = Math.floor((SCREEN_WIDTH - H_PAD * 2 - GAP * (COLS - 1)) / COLS);

export default function TrendingScreen({ onOpenSenti, onOpenUser }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C);

  const [sentis,     setSentis]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeWave, setActiveWave] = useState('All');
  const { hiddenIds } = useBlocks();

  // Trending vs Leaderboard view + leaderboard state
  const [viewMode,        setViewMode]        = useState('trending');    // 'trending' | 'leaderboard'
  const [leaderboardType, setLeaderboardType] = useState('votes');       // 'votes' | 'floats'
  const [leaders,         setLeaders]         = useState([]);
  const [leadersLoading,  setLeadersLoading]  = useState(false);

  // Query trending_sentis view — pass wave filter directly to Supabase.
  // trending_sentis has no creator column, so blocked users are filtered out
  // afterwards by looking up the creators of the returned ids.
  const fetchTrending = useCallback(async (wave = 'All', hidden = []) => {
    try {
      let query = supabase
        .from('trending_sentis')
        .select('id, question, wave, total_reacts, velocity_2h, velocity_24h')
        .order('velocity_24h', { ascending: false })
        .limit(20);

      if (wave !== 'All') {
        query = query.eq('wave', wave);
      }

      const { data, error } = await query;
      if (error) throw error;

      let rows = data ?? [];
      if (hidden.length && rows.length) {
        const { data: blockedRows } = await supabase
          .from('sentis')
          .select('id')
          .in('id', rows.map((r) => r.id))
          .in('user_id', hidden);
        const blockedSet = new Set((blockedRows ?? []).map((r) => r.id));
        rows = rows.filter((r) => !blockedSet.has(r.id));
      }
      setSentis(rows);
    } catch (err) {
      console.error('TrendingScreen fetchTrending error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTrending(activeWave, hiddenIds);
  }, [activeWave, hiddenIds, fetchTrending]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTrending(activeWave, hiddenIds);
  };

  const handleWaveChange = (wave) => {
    setActiveWave(wave);
    setLoading(true);
    setSentis([]);
  };

  // 9:16 tile grid (like Pin). trending_sentis has no image_url → wave colour.
  const renderCard = ({ item }) => (
    <SentiTile
      senti={{ id: item.id, question: item.question, wave: item.wave ?? 'Tech', imageUrl: null }}
      width={TILE_W}
      onPress={() => onOpenSenti?.(item.id)}
    />
  );

  // ── Leaderboard fetch — on entering the tab + whenever the type changes ──
  const fetchLeaderboard = useCallback(async (type) => {
    setLeadersLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        type === 'votes' ? 'get_leaderboard_votes' : 'get_leaderboard_floats'
      );
      if (error) throw error;
      setLeaders(data ?? []);
    } catch (err) {
      console.error('TrendingScreen fetchLeaderboard error', err);
      setLeaders([]);
    } finally {
      setLeadersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'leaderboard') fetchLeaderboard(leaderboardType);
  }, [viewMode, leaderboardType, fetchLeaderboard]);

  const renderLeader = ({ item, index }) => {
    const name  = item.display_name?.trim() || `@${item.username ?? 'citizen'}`;
    const count = leaderboardType === 'votes' ? item.vote_count : item.float_count;
    return (
      <View style={s.leaderRow}>
        <Text style={s.leaderRank}>#{index + 1}</Text>
        <TouchableOpacity style={s.leaderMain} onPress={() => onOpenUser?.(item.user_id)} activeOpacity={0.7}>
          <View style={s.leaderAvatar}>
            {item.avatar_url
              ? <Image source={{ uri: item.avatar_url }} style={s.leaderAvatarImg} resizeMode="cover" />
              : <Text style={s.leaderAvatarText}>{leaderInitials(item)}</Text>}
          </View>
          <Text style={s.leaderName} numberOfLines={1}>{name}</Text>
        </TouchableOpacity>
        <Text style={s.leaderCount}>{formatCount(count)}</Text>
      </View>
    );
  };

  return (
    <View style={s.screen}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />

      {/* Header — Trending | Leaderboard view toggle */}
      <View style={s.header}>
        <Text style={s.title}>Trending</Text>
        <View style={s.viewToggle}>
          {[{ k: 'trending', l: 'Trending' }, { k: 'leaderboard', l: 'Leaderboard' }].map(({ k, l }) => {
            const active = viewMode === k;
            return (
              <TouchableOpacity
                key={k}
                style={[s.viewPill, active ? { backgroundColor: C.accent } : { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border }]}
                onPress={() => setViewMode(k)}
                activeOpacity={0.8}
              >
                <Text style={[s.viewPillText, { color: active ? '#FFFFFF' : C.textMuted }]}>{l}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {viewMode === 'trending' ? (
        <>
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
            <TrendingSkeleton />
          ) : sentis.length === 0 ? (
            <EmptyState
              icon="🔥"
              headline="Nothing trending yet"
              subtext="Check back soon or explore a different wave"
            />
          ) : (
            <FlatList
              data={sentis}
              keyExtractor={(item) => item.id}
              renderItem={renderCard}
              numColumns={COLS}
              columnWrapperStyle={{ gap: GAP }}
              ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
              contentContainerStyle={s.grid}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />
              }
            />
          )}
        </>
      ) : (
        <>
          {/* Top Voters | Top Floaters */}
          <View style={s.lbTypeRow}>
            {[{ k: 'votes', l: 'Top Voters' }, { k: 'floats', l: 'Top Floaters' }].map(({ k, l }) => {
              const active = leaderboardType === k;
              return (
                <TouchableOpacity
                  key={k}
                  style={[s.filterPill, active ? { backgroundColor: C.accent } : { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border }]}
                  onPress={() => setLeaderboardType(k)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.filterText, { color: active ? '#FFFFFF' : C.textMuted }]}>{l}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {leadersLoading ? (
            <View style={s.loader}><ActivityIndicator color={C.accent} /></View>
          ) : leaders.length === 0 ? (
            <EmptyState
              icon="🏆"
              headline="No leaderboard yet"
              subtext="Vote and float to climb the ranks"
            />
          ) : (
            <FlatList
              data={leaders}
              keyExtractor={(item) => item.user_id}
              renderItem={renderLeader}
              contentContainerStyle={s.lbList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
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
  title:         { letterSpacing: -0.2, fontSize: fs(17), fontFamily: F.extraBold, color: C.textPrimary },
  badge: {
    backgroundColor: C.surfaceAlt, borderRadius: ms(20),
    paddingVertical: vs(4), paddingHorizontal: ms(10),
    borderWidth: 0.5, borderColor: C.border,
  },
  badgeText:     { fontSize: fs(12), fontFamily: F.semiBold, color: C.textMuted },
  // Trending | Leaderboard view toggle (sits where the badge did)
  viewToggle:    { flexDirection: 'row', gap: ms(6) },
  viewPill:      { paddingVertical: vs(5), paddingHorizontal: ms(12), borderRadius: ms(20) },
  viewPillText:  { fontSize: fs(12), fontFamily: F.bold },
  // Leaderboard
  lbTypeRow:     { flexDirection: 'row', gap: ms(6), paddingHorizontal: ms(16), paddingTop: vs(12), paddingBottom: vs(4) },
  lbList:        { paddingHorizontal: ms(16), paddingTop: vs(6), paddingBottom: vs(20) },
  leaderRow:     { flexDirection: 'row', alignItems: 'center', gap: ms(10), paddingVertical: vs(10), borderBottomWidth: 0.5, borderBottomColor: C.border },
  leaderRank:    { fontSize: fs(14), fontFamily: F.extraBold, color: C.textMuted, width: ms(34) },
  leaderMain:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: ms(10) },
  leaderAvatar:  { width: ms(38), height: ms(38), borderRadius: ms(19), backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  leaderAvatarImg:  { width: '100%', height: '100%' },
  leaderAvatarText: { fontSize: fs(14), fontFamily: F.bold, color: C.accent },
  leaderName:    { flex: 1, fontSize: fs(14), fontFamily: F.bold, color: C.textPrimary },
  leaderCount:   { fontSize: fs(15), fontFamily: F.extraBold, color: C.textPrimary },
  filterScroll:  { marginTop: vs(10), flexGrow: 0 },
  filterContent: { paddingHorizontal: ms(16), gap: ms(6), paddingBottom: vs(4) },
  filterPill:    { paddingVertical: vs(5), paddingHorizontal: ms(13), borderRadius: ms(20) },
  filterText:    { fontSize: fs(13), fontFamily: F.bold },
  list:          { paddingHorizontal: ms(14), paddingTop: vs(10), gap: vs(8), paddingBottom: vs(20) },
  grid:          { paddingHorizontal: H_PAD, paddingTop: vs(10), paddingBottom: vs(20) },
  card:          { borderRadius: ms(14), borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
  cardImg:       { position: 'relative', justifyContent: 'flex-end', padding: ms(10) },
  overlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  rankBadge: {
    position: 'absolute', top: ms(10), left: ms(10),
    borderRadius: ms(8), paddingVertical: vs(3), paddingHorizontal: ms(8),
  },
  rankBadge1:    { backgroundColor: '#4F46E5' },
  rankBadgeN:    { backgroundColor: 'rgba(255,255,255,0.2)' },
  rankText:      { letterSpacing: -0.2, fontSize: fs(13), fontFamily: F.extraBold, color: '#FFFFFF' },
  cardQuestion: {
    letterSpacing: -0.2, fontSize: fs(14), fontFamily: F.extraBold, color: '#FFFFFF',
    lineHeight: fs(19), position: 'relative', zIndex: 1,
  },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: ms(12), paddingVertical: vs(8),
  },
  cardLeft:      { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  wavePillSmall: { paddingVertical: vs(3), paddingHorizontal: ms(8), borderRadius: ms(20) },
  wavePillText:  { fontSize: fs(12), fontFamily: F.bold, color: '#4338CA' },
  reactCount:    { fontSize: fs(12), fontFamily: F.semiBold, color: C.textMuted },
  velocity:      { fontSize: fs(12), fontFamily: F.bold },
  loader:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ms(32) },
  emptyIcon:     { fontFamily: F.regular, fontSize: fs(40), marginBottom: vs(12) },
  emptyText:     { fontSize: fs(15), fontFamily: F.semiBold, textAlign: 'center' },
});

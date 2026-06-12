// ─────────────────────────────────────────────
// Peolia — PinScreen
// src/screens/PinScreen.jsx
//
// Shows all sentis the current user has pinned.
// Queries: senti_pins joined with sentis + senti_counts
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, useColorScheme, ActivityIndicator,
  StatusBar, Platform, RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s } from '../utils/peoliaScale';

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
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export default function PinScreen({ session, onOpenSenti }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const [pins,       setPins]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const uid = session?.user?.id;

  // ── Fetch pinned sentis ───────────────────────
  const fetchPins = useCallback(async () => {
    if (!uid) return;
    try {
      const { data, error } = await supabase
        .from('senti_pins')
        .select(`
          senti_id,
          sentis!inner(
            id, question, wave, status, created_at,
            senti_counts(total_reacts, yes_count, hmm_count, nah_count, likes, pins)
          )
        `)
        .eq('user_id', uid)
        .eq('sentis.status', 'approved')
        .order('created_at', { referencedTable: 'sentis', ascending: false });

      if (error) throw error;

      // Flatten join into a flat pin shape
      setPins(
        (data ?? [])
          .filter((row) => row.sentis)
          .map((row) => {
            const senti  = row.sentis;
            const counts = senti.senti_counts?.[0] ?? senti.senti_counts ?? {};
            return {
              id:       senti.id,
              question:        senti.question,
              wave:            senti.wave ?? 'Tech',
              totalReacts:     counts.total_reacts ?? 0,
              likes:           counts.likes ?? 0,
              pins:            counts.pins  ?? 0,
            };
          })
      );
    } catch (err) {
      console.error('PinScreen fetchPins error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => { fetchPins(); }, [fetchPins]);

  const handleRefresh = () => { setRefreshing(true); fetchPins(); };

  // ── Unpin ─────────────────────────────────────
  const handleUnpin = useCallback(async (sentiId) => {
    if (!uid) return;

    // Optimistic remove
    setPins((prev) => prev.filter((p) => p.id !== sentiId));

    const { error } = await supabase
      .from('senti_pins')
      .delete()
      .eq('user_id', uid)
      .eq('senti_id', sentiId);

    if (error) {
      console.error('handleUnpin error', error);
      // Restore on failure
      fetchPins();
    }
  }, [uid, fetchPins]);

  // ── Render card ───────────────────────────────
  const renderItem = ({ item }) => {
    const bgColor = WAVE_GRADIENTS[item.wave] ?? '#1E1B4B';
    const emoji   = WAVE_EMOJIS[item.wave] ?? '🌊';

    return (
      <TouchableOpacity
        style={st.card}
        onPress={() => onOpenSenti?.(item.id)}
        activeOpacity={0.85}
      >
        {/* Wave colour strip */}
        <View style={[st.strip, { backgroundColor: bgColor }]}>
          <View style={st.stripOverlay} />
          <View style={[st.wavePill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Text style={st.wavePillText}>{emoji} {item.wave?.toUpperCase()} WAVE</Text>
          </View>
        </View>

        {/* Content row */}
        <View style={st.cardBody}>
          <View style={st.cardContent}>
            <Text style={[st.question, { color: C.textPrimary }]} numberOfLines={2}>
              {item.question}
            </Text>
            <View style={st.countRow}>
              <Text style={[st.countText, { color: C.textMuted }]}>
                🌊 {formatCount(item.totalReacts)} reacts
              </Text>
              <Text style={[st.countText, { color: C.textMuted }]}>
                ♥ {formatCount(item.likes)}
              </Text>
              <Text style={[st.countText, { color: C.textMuted }]}>
                🔖 {formatCount(item.pins)}
              </Text>
            </View>
          </View>

          {/* Unpin button — direct tap, optimistic remove (restored on DB failure) */}
          <TouchableOpacity
            style={st.unpinBtn}
            onPress={() => handleUnpin(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Text style={[st.unpinIcon, { color: C.accent }]}>🔖</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Screen ────────────────────────────────────
  return (
    <View style={st.screen}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />

      {/* Header */}
      <View style={st.header}>
        <Text style={[st.title, { color: C.textPrimary }]}>Pinned</Text>
        <Text style={[st.subtitle, { color: C.textSecondary }]}>
          Sentis you want to revisit
        </Text>
      </View>

      {loading ? (
        <View style={st.loader}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : pins.length === 0 ? (
        <View style={st.empty}>
          <Text style={st.emptyIcon}>🔖</Text>
          <Text style={[st.emptyText, { color: C.textSecondary }]}>
            Nothing pinned yet.{'\n'}Pin sentis you want to revisit.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pins}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: vs(10) }} />}
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
  header: { paddingHorizontal: ms(16), paddingTop: vs(12), paddingBottom: vs(4) },
  title:    { fontSize: fs(22), fontWeight: '800' },
  subtitle: { fontSize: fs(14), marginTop: vs(2) },
  loader:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ms(32),
  },
  emptyIcon: { fontSize: fs(44), marginBottom: vs(14) },
  emptyText: { fontSize: fs(15), fontWeight: '500', textAlign: 'center', lineHeight: fs(24) },
  list: { paddingHorizontal: ms(14), paddingTop: vs(12), paddingBottom: vs(24) },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: ms(14),
    borderWidth: 0.5,
    borderColor: C.border,
    overflow: 'hidden',
  },
  strip: {
    height: vs(50),
    justifyContent: 'flex-end',
    padding: ms(10),
    position: 'relative',
  },
  stripOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  wavePill: {
    borderRadius: ms(20),
    paddingVertical: vs(3),
    paddingHorizontal: ms(10),
    alignSelf: 'flex-start',
    position: 'relative',
    zIndex: 1,
  },
  wavePillText: { fontSize: fs(11), fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.4 },

  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(14),
    paddingVertical: vs(12),
    gap: ms(10),
  },
  cardContent: { flex: 1, gap: vs(6) },
  question:    { fontSize: fs(15), fontWeight: '700', lineHeight: fs(21) },
  countRow:    { flexDirection: 'row', gap: ms(12) },
  countText:   { fontSize: fs(12), fontWeight: '500' },
  unpinBtn:    { padding: ms(4) },
  unpinIcon:   { fontSize: fs(20) },
});

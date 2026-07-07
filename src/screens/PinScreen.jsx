// ─────────────────────────────────────────────
// Peolia — PinScreen
// src/screens/PinScreen.jsx
//
// Shows all sentis the current user has pinned.
// Queries: senti_pins joined with sentis + senti_counts
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Platform,
  RefreshControl,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';
import { usePins } from '../context/PinsContext';
import { supabase } from '../lib/supabase';

import { fs, ms, vs, SCREEN_WIDTH } from '../utils/peoliaScale';
import SentiTile from '../components/SentiTile';
import EmptyState from '../components/EmptyState';
import { GridSkeleton } from '../components/Skeletons';

// 3-column grid metrics
const COLS   = 3;
const GAP    = ms(8);
const H_PAD  = ms(14);
const TILE_W = Math.floor((SCREEN_WIDTH - H_PAD * 2 - GAP * (COLS - 1)) / COLS);

export default function PinScreen({ session, onOpenSenti }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const { pinnedIds, unpin } = usePins();

  const [pins,       setPins]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const uid = session?.user?.id;

  // ── Fetch pinned sentis ───────────────────────
  const fetchPins = useCallback(async () => {
    if (!uid) return;
    try {
      if (!pinnedIds.length) { setPins([]); return; }
      const { data, error } = await supabase
        .from('sentis')
        .select('id, question, wave, image_url, created_at')
        .in('id', pinnedIds)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPins(
        (data ?? []).map((senti) => ({
          id:       senti.id,
          question: senti.question,
          wave:     senti.wave ?? 'Tech',
          imageUrl: senti.image_url ?? null,
        }))
      );
    } catch (err) {
      console.error('PinScreen fetchPins error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid, pinnedIds]);

  // Re-fetch on mount AND whenever the pinned set changes (pin/unpin elsewhere).
  useEffect(() => { fetchPins(); }, [fetchPins]);

  const handleRefresh = () => { setRefreshing(true); fetchPins(); };

  // ── Unpin ─────────────────────────────────────
  const handleUnpin = useCallback(async (sentiId) => {
    if (!uid) return;

    // Optimistic remove
    setPins((prev) => prev.filter((p) => p.id !== sentiId));

    const ok = await unpin(sentiId);
    if (!ok) {
      // Restore on failure
      fetchPins();
    }
  }, [uid, unpin, fetchPins]);

  // ── Render tile (9:16, image or wave colour) — tap opens, 📌 unpins ──
  const renderItem = ({ item }) => (
    <SentiTile
      senti={item}
      width={TILE_W}
      onPress={() => onOpenSenti?.(item.id)}
      onUnpin={() => handleUnpin(item.id)}
    />
  );

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
        <GridSkeleton columns={COLS} count={9} paddingHorizontal={H_PAD} gap={GAP} />
      ) : pins.length === 0 ? (
        <EmptyState
          icon="📌"
          headline="Nothing pinned yet"
          subtext="Tap the pin icon on any senti to save it here"
        />
      ) : (
        <FlatList
          data={pins}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
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
  title:    { letterSpacing: -0.2, fontSize: fs(22), fontFamily: F.extraBold },
  subtitle: { fontFamily: F.regular, fontSize: fs(14), marginTop: vs(2) },
  loader:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ms(32),
  },
  emptyIcon: { fontFamily: F.regular, fontSize: fs(44), marginBottom: vs(14) },
  emptyText: { fontSize: fs(15), fontFamily: F.semiBold, textAlign: 'center', lineHeight: fs(24) },
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
  wavePillText: { fontSize: fs(11), fontFamily: F.bold, color: '#FFFFFF', letterSpacing: 0.4 },

  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(14),
    paddingVertical: vs(12),
    gap: ms(10),
  },
  cardContent: { flex: 1, gap: vs(6) },
  question:    { fontSize: fs(15), fontFamily: F.bold, lineHeight: fs(21) },
  countRow:    { flexDirection: 'row', gap: ms(12) },
  countText:   { fontSize: fs(12), fontFamily: F.semiBold },
  unpinBtn:    { padding: ms(4) },
  unpinIcon:   { fontFamily: F.regular, fontSize: fs(20) },
});

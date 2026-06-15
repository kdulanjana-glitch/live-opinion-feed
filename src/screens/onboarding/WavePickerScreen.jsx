// ─────────────────────────────────────────────
// Peolia — Onboarding / WavePickerScreen (Step 3 of 4)
// src/screens/onboarding/WavePickerScreen.jsx
//
// Pick at least 3 waves (interests). Saved to user_wave_stats.
//
// Props: onDone: () => void, userId: string
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, useColorScheme, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { getPeoliaColors } from '../../constants/peoliaTheme';
import { fs, ms, vs, s } from '../../utils/peoliaScale';

const ALL_WAVES = [
  { key: 'Tech',          emoji: '💻' },
  { key: 'Love',          emoji: '❤️' },
  { key: 'Money',         emoji: '💰' },
  { key: 'Life',          emoji: '🌱' },
  { key: 'Society',       emoji: '🌍' },
  { key: 'Politics',      emoji: '🏛️' },
  { key: 'Food',          emoji: '🍕' },
  { key: 'Health',        emoji: '💪' },
  { key: 'Sports',        emoji: '⚽' },
  { key: 'Entertainment', emoji: '🎬' },
  { key: 'Science',       emoji: '🔬' },
  { key: 'Education',     emoji: '📚' },
  { key: 'Environment',   emoji: '🌿' },
];

const MIN_WAVES = 3;

export default function WavePickerScreen({ onDone, onBack, userId }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const [selected, setSelected] = useState([]);
  const [saving,   setSaving]   = useState(false);

  const toggle = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const canContinue = selected.length >= MIN_WAVES && !saving;

  const handleContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      // Use the LIVE authenticated user so user_id always equals auth.uid()
      // (the RLS WITH CHECK). A stale/empty userId prop would fail the insert.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Session expired', 'Please sign in again to continue.'); return; }

      const { error } = await supabase
        .from('user_wave_stats')
        .upsert(
          selected.map((wave) => ({ user_id: user.id, wave, react_count: 0 })),
          { onConflict: 'user_id,wave' }
        );
      if (error) throw error;
      onDone?.();
    } catch (err) {
      Alert.alert('Could not save', err.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.content}
      showsVerticalScrollIndicator={false}
    >
      {onBack && (
        <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7}>
          <Text style={st.backText}>← Back</Text>
        </TouchableOpacity>
      )}

      <Text style={st.step}>Step 3 of 4</Text>
      <Text style={st.title}>Pick your waves</Text>
      <Text style={st.subtitle}>Choose at least 3 topics that interest you.</Text>

      <View style={st.pillsRow}>
        {ALL_WAVES.map(({ key, emoji }) => {
          const active = selected.includes(key);
          return (
            <TouchableOpacity
              key={key}
              style={[st.pill, active ? st.pillActive : st.pillInactive]}
              onPress={() => toggle(key)}
              activeOpacity={0.8}
            >
              <Text style={[st.pillText, active ? st.pillTextActive : st.pillTextInactive]}>
                {emoji} {key}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[st.counter, { color: selected.length >= MIN_WAVES ? C.accent : C.textMuted }]}>
        {selected.length} selected
      </Text>

      <TouchableOpacity
        style={[st.continueBtn, !canContinue && st.continueDisabled]}
        onPress={handleContinue}
        disabled={!canContinue}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color="#FFFFFF" size="small" />
          : <Text style={st.continueText}>Continue</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: ms(24), paddingTop: vs(56), paddingBottom: vs(32) },
  backBtn:  { marginBottom: vs(10) },
  backText: { fontSize: fs(13), fontWeight: '600', color: C.textSecondary },
  step:     { fontSize: fs(10), color: C.textMuted },
  title:    { fontSize: fs(22), fontWeight: '800', color: C.textPrimary, marginTop: vs(8) },
  subtitle: { fontSize: fs(12), color: C.textSecondary, marginTop: vs(4) },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8), marginTop: vs(20) },
  pill: {
    paddingVertical: vs(10), paddingHorizontal: ms(16), borderRadius: s(20),
  },
  pillActive:   { backgroundColor: C.accent },
  pillInactive: { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border },
  pillText:         { fontSize: fs(12), fontWeight: '700' },
  pillTextActive:   { color: '#FFFFFF' },
  pillTextInactive: { color: C.textSecondary },
  counter: { fontSize: fs(10), fontWeight: '600', marginTop: vs(12) },
  continueBtn: {
    backgroundColor: C.accent, paddingVertical: vs(14), borderRadius: s(30),
    alignItems: 'center', marginTop: vs(28),
  },
  continueDisabled: { opacity: 0.5 },
  continueText: { fontSize: fs(13), fontWeight: '800', color: '#FFFFFF' },
});

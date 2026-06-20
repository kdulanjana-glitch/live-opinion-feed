// ─────────────────────────────────────────────
// Peolia — Onboarding / YoureInScreen (Step 3 of 3)
// src/screens/onboarding/YoureInScreen.jsx
//
// Celebration screen. Marks onboarding_completed = true on mount (best-effort,
// never blocks the user), then enters the app via onDone().
//
// Props: onDone: () => void, userId: string
// ─────────────────────────────────────────────

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { usePeoliaScheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { getPeoliaColors } from '../../constants/peoliaTheme';
import { fs, ms, vs, s } from '../../utils/peoliaScale';

export default function YoureInScreen({ onDone, userId }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  // Mark onboarding complete on mount — best-effort, never blocks the user
  useEffect(() => {
    (async () => {
      try {
        await supabase.from('users').update({ onboarding_completed: true }).eq('id', userId);
      } catch (err) {
        console.warn('YoureInScreen: failed to mark onboarding complete', err);
      }
    })();
  }, [userId]);

  return (
    <View style={st.screen}>
      <Text style={st.step}>Step 3 of 3</Text>
      <Text style={st.emoji}>🌊</Text>
      <Text style={st.title}>You're In, Citizen.</Text>
      <Text style={st.body}>
        The Sentarium is waiting. Float your first senti and let the world react.
      </Text>

      <TouchableOpacity style={st.enterBtn} onPress={() => onDone?.()} activeOpacity={0.85}>
        <Text style={st.enterText}>Enter the Sentarium</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step:  { fontSize: fs(10), color: C.textMuted },
  emoji: { fontSize: fs(72), marginTop: vs(16) },
  title: {
    fontSize: fs(26), fontWeight: '800', color: C.textPrimary,
    marginTop: vs(16), textAlign: 'center',
  },
  body: {
    fontSize: fs(13), color: C.textSecondary, textAlign: 'center',
    lineHeight: fs(20), marginTop: vs(10), paddingHorizontal: ms(32),
  },
  enterBtn: {
    alignSelf: 'stretch',
    backgroundColor: C.accent,
    paddingVertical: vs(15),
    borderRadius: s(30),
    marginHorizontal: ms(24),
    marginTop: vs(32),
    alignItems: 'center',
  },
  enterText: { fontSize: fs(14), fontWeight: '800', color: '#FFFFFF' },
});

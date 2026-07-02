// ─────────────────────────────────────────────
// Peolia — SuspendedScreen
// src/screens/SuspendedScreen.jsx
//
// Full-screen block shown when a signed-in citizen's account is banned
// (detected at startup, at sign-in, or live mid-session via the ban-watch
// realtime channel in index.tsx). No back button, no tab bar — the only
// way out is Sign out.
//
// Props: onSignOut() — called after supabase sign-out so the host resets state.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { PeoliaFonts as F, getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabase';
import { fs, ms, vs } from '../utils/peoliaScale';

// Documented hardcoded-color exception: danger red.
const DANGER = '#DC2626';

export default function SuspendedScreen({ onSignOut }) {
  const scheme = usePeoliaScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // even if the network call fails, let the host reset local state
    }
    onSignOut?.();
    setSigningOut(false);
  };

  return (
    <View style={st.screen}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      <Icon name="ti-ban" size={fs(64)} color={DANGER} />

      <Text style={st.title}>Account suspended</Text>

      <Text style={st.body}>Your account has been suspended.</Text>

      <Text style={st.hint}>
        If you believe this is a mistake, please contact us via the support form in Settings.
      </Text>

      <TouchableOpacity style={st.signOutBtn} onPress={handleSignOut} disabled={signingOut} activeOpacity={0.7}>
        {signingOut
          ? <ActivityIndicator color={C.textSecondary} size="small" />
          : <Text style={st.signOutText}>Sign out</Text>}
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
    paddingHorizontal: ms(32),
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  title: {
    fontSize: fs(20), fontFamily: F.extraBold, letterSpacing: -0.2,
    color: C.textPrimary, textAlign: 'center', marginTop: vs(24),
  },
  body: {
    fontSize: fs(13), fontFamily: F.regular, color: C.textSecondary,
    textAlign: 'center', maxWidth: ms(260), marginTop: vs(12),
  },
  hint: {
    fontSize: fs(11), fontFamily: F.regular, color: C.textMuted,
    textAlign: 'center', maxWidth: ms(260), marginTop: vs(8), lineHeight: fs(16),
  },
  signOutBtn: {
    marginTop: vs(40),
    paddingVertical: vs(10), paddingHorizontal: ms(28),
    borderRadius: ms(20),
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
  },
  signOutText: { fontSize: fs(12), fontFamily: F.bold, color: C.textSecondary },
});

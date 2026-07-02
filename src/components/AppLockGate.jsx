// ─────────────────────────────────────────────
// Peolia — AppLockGate
// src/components/AppLockGate.jsx
//
// Root-level biometric lock. When 'peolia_app_lock' is 'true' in AsyncStorage,
// the app content is covered by a lock overlay on launch and whenever the app
// returns to the foreground, until LocalAuthentication confirms the citizen.
//
// Enabling/disabling the flag happens in SettingsScreen (Security tab). This
// component only ENFORCES it. Must live inside ThemeProvider (uses the scheme).
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePeoliaScheme } from '../context/ThemeContext';

import { fs, ms, vs } from '../utils/peoliaScale';

// Optional native module — absent in Expo Go / dev builds made before it was
// added. Guard the require so the app still boots; app-lock just stays
// unavailable until a build that includes the module is installed.
let LocalAuthentication = null;
try { LocalAuthentication = require('expo-local-authentication'); } catch {}

const KEY = 'peolia_app_lock';

export default function AppLockGate({ children }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const [checking, setChecking] = useState(true);   // reading the flag on first mount
  const [enabled,  setEnabled]  = useState(false);
  const [locked,   setLocked]   = useState(false);

  const appState  = useRef(AppState.currentState);
  const prompting = useRef(false);

  const authenticate = useCallback(async () => {
    if (!LocalAuthentication) { setLocked(false); return; }
    if (prompting.current) return;
    prompting.current = true;
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Peolia',
      });
      if (res.success) setLocked(false);
    } catch {
      // leave it locked — the "Unlock" button lets them retry
    } finally {
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      let on = false;
      try { on = (await AsyncStorage.getItem(KEY)) === 'true'; } catch {}
      on = on && !!LocalAuthentication;  // can't enforce a lock we can't authenticate
      if (!mounted) return;
      setEnabled(on);
      setLocked(on);
      setChecking(false);
      if (on) authenticate();
    })();

    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appState.current;
      appState.current = next;
      // Coming back to the foreground → re-check the flag and re-lock.
      if (next === 'active' && prev !== 'active') {
        let on = false;
        try { on = (await AsyncStorage.getItem(KEY)) === 'true'; } catch {}
        on = on && !!LocalAuthentication;
        setEnabled(on);
        if (on) { setLocked(true); authenticate(); }
      }
    });

    return () => { mounted = false; sub.remove(); };
  }, [authenticate]);

  // Brief neutral screen while we read the flag — avoids flashing either the
  // protected content or the lock UI before we know which to show.
  if (checking) return <View style={st.cover} />;

  return (
    <View style={st.fill}>
      {children}
      {enabled && locked && (
        <View style={st.cover}>
          <Text style={st.icon}>🔒</Text>
          <Text style={st.title}>Peolia is locked</Text>
          <Text style={st.subtitle}>Unlock with your fingerprint or face to continue.</Text>
          <TouchableOpacity style={st.btn} onPress={authenticate} activeOpacity={0.8}>
            <Text style={st.btnText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  fill: { flex: 1 },
  cover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(32),
    zIndex: 999,
  },
  icon:     { fontFamily: F.regular, fontSize: fs(44), marginBottom: vs(14) },
  title:    { letterSpacing: -0.2, fontSize: fs(20), fontFamily: F.extraBold, color: C.textPrimary, marginBottom: vs(8) },
  subtitle: { fontFamily: F.regular, fontSize: fs(14), color: C.textSecondary, textAlign: 'center', lineHeight: fs(21), marginBottom: vs(22) },
  btn: {
    paddingVertical: vs(11), paddingHorizontal: ms(32),
    borderRadius: ms(22), backgroundColor: C.accent,
  },
  btnText: { fontSize: fs(15), fontFamily: F.bold, color: '#FFFFFF' },
});

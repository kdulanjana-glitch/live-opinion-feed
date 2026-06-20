// ─────────────────────────────────────────────
// Peolia — ThemeContext
// src/context/ThemeContext.jsx
//
// Wraps the app so any screen can read the EFFECTIVE color scheme via
// usePeoliaScheme(), which respects a manually-chosen override ('light' |
// 'dark') and falls back to the device setting when the citizen picks 'system'.
//
// This is the ONE file that legitimately imports React Native's raw
// useColorScheme — everywhere else uses usePeoliaScheme().
// ─────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'peolia_theme_pref';

// themePref: 'light' | 'dark' | 'system'   (default 'system')
const ThemeContext = createContext({
  themePref: 'system',
  scheme: 'light',
  setThemePref: () => {},
});

export function ThemeProvider({ children }) {
  const deviceScheme = useColorScheme();          // 'light' | 'dark' | null
  const [themePref, setThemePrefState] = useState('system');

  // Load the persisted preference once on mount.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemePrefState(saved);
        }
      } catch {
        // ignore — fall back to 'system'
      }
    })();
  }, []);

  // Update state immediately (no flash) then persist in the background.
  const setThemePref = (value) => {
    setThemePrefState(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  };

  const effectiveScheme =
    themePref === 'system' ? (deviceScheme === 'dark' ? 'dark' : 'light') : themePref;

  return (
    <ThemeContext.Provider value={{ themePref, scheme: effectiveScheme, setThemePref }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Effective scheme ('light' | 'dark') — drop-in replacement for useColorScheme().
export function usePeoliaScheme() {
  return useContext(ThemeContext).scheme;
}

// Full theme controls — for the Settings appearance section.
export function useThemePref() {
  const { themePref, setThemePref } = useContext(ThemeContext);
  return { themePref, setThemePref };
}

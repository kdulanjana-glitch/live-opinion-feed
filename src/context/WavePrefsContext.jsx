// ─────────────────────────────────────────────
// Peolia — WavePrefsContext
// src/context/WavePrefsContext.jsx
//
// Single source of truth for the citizen's per-wave preferences
// (wave_preferences table): { wave: { level, excluded, dna_include } }.
//
// Shared so a change made in Settings → Personalize propagates live to:
//   • SentariumScreen — re-shapes the feed (excluded waves drop immediately)
//   • ProfileScreen   — re-filters the Citizen DNA chart (own profile)
// without any refetch or app restart.
//
// setWavePref() is optimistic: it updates local state first, upserts in the
// background, and rolls back on error. Edits persist per tap (no Save button).
// ─────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// The 13 waves (capitalized — matches the feed, user_wave_stats, WAVE_EMOJIS).
export const ALL_WAVES = [
  'Tech', 'Love', 'Money', 'Life', 'Society',
  'Politics', 'Food', 'Health', 'Sports',
  'Entertainment', 'Science', 'Education', 'Environment',
];

// Default when a wave has no wave_preferences row yet.
export const DEFAULT_PREF = { level: 'high', excluded: false, dna_include: true };

// Build the all-13-waves default, then override with any DB rows.
export const buildWavePrefs = (rows = []) => {
  const prefs = {};
  ALL_WAVES.forEach((w) => { prefs[w] = { ...DEFAULT_PREF }; });
  rows.forEach((r) => {
    if (!r?.wave) return;
    prefs[r.wave] = {
      level:       r.level ?? DEFAULT_PREF.level,
      excluded:    r.excluded ?? DEFAULT_PREF.excluded,
      dna_include: r.dna_include ?? DEFAULT_PREF.dna_include,
    };
  });
  return prefs;
};

const WavePrefsContext = createContext(null);

export function WavePrefsProvider({ children }) {
  const [wavePrefs, setWavePrefs] = useState({});   // {} until first load
  const [loading,   setLoading]   = useState(true);

  const uidRef   = useRef(null);
  const prefsRef = useRef({});                       // mirror for synchronous reads
  useEffect(() => { prefsRef.current = wavePrefs; }, [wavePrefs]);

  const load = useCallback(async (uid) => {
    if (!uid) { setWavePrefs({}); setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('wave_preferences')
        .select('wave, level, excluded, dna_include')
        .eq('user_id', uid);
      setWavePrefs(buildWavePrefs(data ?? []));
    } catch {
      // table missing / unreachable — fall back to all-default (no-op shaping)
      setWavePrefs(buildWavePrefs());
    } finally {
      setLoading(false);
    }
  }, []);

  // Identify current user (mount + auth changes), then load their prefs.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      uidRef.current = user?.id ?? null;
      load(uidRef.current);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      uidRef.current = session?.user?.id ?? null;
      load(uidRef.current);
    });
    return () => subscription.unsubscribe();
  }, [load]);

  // Optimistic per-wave update + upsert + rollback. Returns true on success.
  const setWavePref = useCallback(async (wave, changes) => {
    const uid = uidRef.current;
    if (!uid) return false;

    const prev    = prefsRef.current;
    const current = prev[wave] ?? DEFAULT_PREF;
    const merged  = { ...current, ...changes };
    const next    = { ...prev, [wave]: merged };
    prefsRef.current = next;
    setWavePrefs(next);

    const { error } = await supabase
      .from('wave_preferences')
      .upsert(
        {
          user_id:     uid,
          wave,
          level:       merged.level,
          excluded:    merged.excluded,
          dna_include: merged.dna_include,
          updated_at:  new Date().toISOString(),
        },
        { onConflict: 'user_id,wave' }
      );

    if (error) {
      console.error('setWavePref error', error);
      prefsRef.current = prev;
      setWavePrefs(prev);
      return false;
    }
    return true;
  }, []);

  return (
    <WavePrefsContext.Provider
      value={{ wavePrefs, loading, setWavePref, refreshWavePrefs: () => load(uidRef.current) }}
    >
      {children}
    </WavePrefsContext.Provider>
  );
}

export function useWavePrefs() {
  const ctx = useContext(WavePrefsContext);
  return ctx ?? {
    wavePrefs: {},
    loading: false,
    setWavePref: async () => false,
    refreshWavePrefs: () => {},
  };
}

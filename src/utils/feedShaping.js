// ─────────────────────────────────────────────
// Peolia — feed shaping (wave preferences)
// src/utils/feedShaping.js
//
// Pure logic extracted from SentariumScreen so it's unit-testable.
// Takes a raw pool of normalised sentis and the citizen's wave_preferences map,
// returns a TARGET-sized weighted selection:
//   • excluded waves are dropped entirely
//   • remaining waves get slots proportional to their Low/Mid/High weight
//   • per-wave pools and the final selection are shuffled
// ─────────────────────────────────────────────

export const FETCH_POOL    = 90;   // raw rows fetched per page
export const TARGET        = 30;   // shaped sentis returned per page
export const LEVEL_WEIGHTS = { high: 100, mid: 50, low: 20 };

export function applyWavePreferences(sentis, wavePrefs) {
  const filtered = sentis.filter((s) => !wavePrefs[s.wave]?.excluded);

  const byWave = {};
  filtered.forEach((s) => { (byWave[s.wave] ??= []).push(s); });

  const waves = Object.keys(byWave);
  const totalWeight = waves.reduce(
    (sum, wave) => sum + LEVEL_WEIGHTS[wavePrefs[wave]?.level ?? 'high'],
    0,
  );
  if (totalWeight === 0) return filtered.slice(0, TARGET);

  const selected = [];
  waves.forEach((wave) => {
    const weight = LEVEL_WEIGHTS[wavePrefs[wave]?.level ?? 'high'];
    const slots  = Math.max(1, Math.round((weight / totalWeight) * TARGET));
    const pool   = [...byWave[wave]].sort(() => Math.random() - 0.5);
    selected.push(...pool.slice(0, Math.min(slots, pool.length)));
  });

  return selected.sort(() => Math.random() - 0.5).slice(0, TARGET);
}

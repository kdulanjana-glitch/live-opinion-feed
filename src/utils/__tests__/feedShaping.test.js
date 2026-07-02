// Tests for the wave-preference feed shaping (pure logic).
import { applyWavePreferences, TARGET, LEVEL_WEIGHTS } from '../feedShaping';

// Build n fake sentis for a wave.
const make = (wave, n) =>
  Array.from({ length: n }, (_, i) => ({ id: `${wave}-${i}`, wave }));

const pref = (level = 'high', excluded = false) => ({ level, excluded, dna_include: true });

describe('applyWavePreferences', () => {
  test('returns at most TARGET sentis', () => {
    const pool = [...make('Tech', 50), ...make('Love', 50)];
    const out = applyWavePreferences(pool, { Tech: pref(), Love: pref() });
    expect(out.length).toBeLessThanOrEqual(TARGET);
    expect(out.length).toBeGreaterThan(0);
  });

  test('excluded waves never appear', () => {
    const pool = [...make('Tech', 40), ...make('Politics', 40)];
    const out = applyWavePreferences(pool, {
      Tech: pref('high'),
      Politics: pref('high', true),
    });
    expect(out.some((s) => s.wave === 'Politics')).toBe(false);
    expect(out.every((s) => s.wave === 'Tech')).toBe(true);
  });

  test('all waves excluded → empty result', () => {
    const pool = make('Tech', 30);
    const out = applyWavePreferences(pool, { Tech: pref('high', true) });
    expect(out).toEqual([]);
  });

  test('low-weight wave gets proportionally fewer slots than high', () => {
    // Two waves with plenty of supply: high should out-fill low ~5:1 (100 vs 20).
    const pool = [...make('Tech', 60), ...make('Food', 60)];
    const out = applyWavePreferences(pool, { Tech: pref('high'), Food: pref('low') });
    const techCount = out.filter((s) => s.wave === 'Tech').length;
    const foodCount = out.filter((s) => s.wave === 'Food').length;
    // Expected slots: Tech round(100/120*30)=25, Food max(1, round(20/120*30))=5
    expect(techCount).toBe(25);
    expect(foodCount).toBe(5);
  });

  test('waves without a pref entry default to high', () => {
    const pool = [...make('Tech', 40), ...make('Life', 40)];
    const out = applyWavePreferences(pool, {});   // no prefs at all
    const techCount = out.filter((s) => s.wave === 'Tech').length;
    const lifeCount = out.filter((s) => s.wave === 'Life').length;
    // Equal weights → 15/15
    expect(techCount).toBe(15);
    expect(lifeCount).toBe(15);
  });

  test('every wave with sentis gets at least one slot', () => {
    const pool = [...make('Tech', 60), ...make('Money', 2)];
    const out = applyWavePreferences(pool, { Tech: pref('high'), Money: pref('low') });
    expect(out.some((s) => s.wave === 'Money')).toBe(true);
  });

  test('never invents sentis — output ⊆ input, no duplicates', () => {
    const pool = [...make('Tech', 10), ...make('Love', 3)];
    const out = applyWavePreferences(pool, { Tech: pref(), Love: pref('mid') });
    const inputIds = new Set(pool.map((s) => s.id));
    const outIds = out.map((s) => s.id);
    expect(new Set(outIds).size).toBe(outIds.length);
    outIds.forEach((id) => expect(inputIds.has(id)).toBe(true));
  });

  test('empty pool → empty result', () => {
    expect(applyWavePreferences([], { Tech: pref() })).toEqual([]);
  });

  test('level weights are ordered high > mid > low', () => {
    expect(LEVEL_WEIGHTS.high).toBeGreaterThan(LEVEL_WEIGHTS.mid);
    expect(LEVEL_WEIGHTS.mid).toBeGreaterThan(LEVEL_WEIGHTS.low);
  });
});

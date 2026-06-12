// ─────────────────────────────────────────────
// Peolia — Responsive Scale Utility
// src/utils/peoliaScale.js
//
// Scales all sizes proportionally based on
// the device's actual screen width vs the
// design base width (390px = iPhone 14 standard).
//
// Usage:
//   import { s, vs, ms, fs } from '../utils/peoliaScale';
//
//   s(14)   → scale horizontal/width values
//   vs(14)  → scale vertical/height values
//   ms(14)  → scale with moderation (layout gaps, padding)
//   fs(14)  → scale font sizes (most important)
// ─────────────────────────────────────────────

import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Design base dimensions (standard Android ~390pt logical width)
const BASE_W = 390;
const BASE_H = 844;

// Scale ratios
const wScale = SCREEN_W / BASE_W;
const hScale = SCREEN_H / BASE_H;

/**
 * s() — horizontal scale
 * Use for: widths, horizontal padding, gap, borderRadius
 */
export const s = (size) => Math.round(size * wScale);

/**
 * vs() — vertical scale
 * Use for: heights, vertical padding, marginTop/Bottom
 */
export const vs = (size) => Math.round(size * hScale);

/**
 * ms() — moderate scale (dampened)
 * Use for: padding, gap, borderRadius — avoids over-scaling on large screens
 * factor: 0 = no scale, 1 = full scale. Default 0.5 is a good balance.
 */
export const ms = (size, factor = 0.5) =>
  Math.round(size + (s(size) - size) * factor);

/**
 * fs() — font scale
 * Uses moderate scaling + respects accessibility font size settings.
 * Use for ALL fontSize values.
 */
export const fs = (size) => {
  const scaled = ms(size, 0.45);
  // Respect user's accessibility font scaling (up to 1.3x max)
  const fontScale = Math.min(PixelRatio.getFontScale(), 1.3);
  return Math.round(scaled * fontScale);
};

// Export screen dimensions for layout use
export const SCREEN_WIDTH  = SCREEN_W;
export const SCREEN_HEIGHT = SCREEN_H;

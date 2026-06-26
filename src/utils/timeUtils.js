// ─────────────────────────────────────────────
// Peolia — timeUtils
// src/utils/timeUtils.js
//
// Relative timestamp helper for chat / lists:
//   < 60s  → 'now'
//   < 60m  → 'Xm'
//   < 24h  → 'Xh'
//   else   → weekday name ('Mon')
// ─────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function relativeTime(input) {
  if (!input) return '';
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return '';

  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  return DAYS[new Date(then).getDay()];
}

// Clock time for a message bubble, e.g. "3:07 PM".
export function clockTime(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

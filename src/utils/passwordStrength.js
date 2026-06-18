// ─────────────────────────────────────────────
// Peolia — passwordStrength
// src/utils/passwordStrength.js
//
// Tiny, dependency-free password strength estimator (built from scratch in
// place of zxcvbn — no native module, works in Expo Go). Returns a 0–4 score
// plus a label; the UI maps the score to a colour/fill width.
// ─────────────────────────────────────────────

const COMMON = [
  'password', 'passw0rd', '12345678', '123456789', '1234567890',
  'qwerty', 'qwertyuiop', 'abc123', 'iloveyou', 'admin', 'welcome',
  'letmein', 'monkey', 'dragon', 'football', 'baseball', 'peolia',
];

const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

// Returns { score: 0..4, label } — or { score: -1, label: '' } for empty input.
export function passwordStrength(raw) {
  const pw = raw ?? '';
  if (!pw) return { score: -1, label: '' };

  const lower = pw.toLowerCase();

  // Hard fail: too short or a well-known password.
  if (pw.length < 6 || COMMON.includes(lower)) {
    return { score: 0, label: LABELS[0] };
  }

  let score = 0;

  // Length tiers.
  if (pw.length >= 8)  score += 1;
  if (pw.length >= 12) score += 1;
  if (pw.length >= 16) score += 1;

  // Character variety.
  let classes = 0;
  if (/[a-z]/.test(pw)) classes += 1;
  if (/[A-Z]/.test(pw)) classes += 1;
  if (/[0-9]/.test(pw)) classes += 1;
  if (/[^A-Za-z0-9]/.test(pw)) classes += 1;
  if (classes >= 2) score += 1;
  if (classes >= 4) score += 1;

  // Penalties: a single repeated char, or pure digits/letters.
  if (/^(.)\1+$/.test(pw)) score -= 2;
  if (/^[0-9]+$/.test(pw) || /^[a-zA-Z]+$/.test(pw)) score -= 1;

  score = Math.max(0, Math.min(4, score));
  return { score, label: LABELS[score] };
}

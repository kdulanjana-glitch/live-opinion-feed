// ─────────────────────────────────────────────
// Peolia — crash reporting (Sentry, DSN-gated)
// src/lib/crash.js
//
// Sentry is wired but DORMANT until a DSN is set below. With an empty DSN,
// initCrashReporting/captureError are no-ops — no native module is touched, so
// builds made BEFORE @sentry/react-native was added keep working unchanged.
//
// To activate (free tier):
//   1. Create a project at sentry.io (React Native platform) → copy its DSN.
//   2. Paste the DSN below.
//   3. Rebuild the dev client (`eas build --profile development -p android`) —
//      Sentry ships native code, so the FIRST activation needs a rebuild.
//      After that, JS changes hot-reload as usual.
// ─────────────────────────────────────────────

export const SENTRY_DSN = '';   // ← paste your Sentry DSN here to activate

let Sentry = null;

export function initCrashReporting() {
  if (!SENTRY_DSN) return;
  try {
    // Required lazily so a build without the native module never loads it.
    Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0.2,      // light performance sampling
      enableNativeCrashHandling: true,
      // Never send citizen PII with events.
      sendDefaultPii: false,
    });
  } catch (err) {
    console.warn('Sentry init failed (native module missing? rebuild needed):', err?.message);
    Sentry = null;
  }
}

// Report a handled error (no-op until Sentry is active).
export function captureError(error, context) {
  if (!Sentry) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // never let crash reporting crash the app
  }
}

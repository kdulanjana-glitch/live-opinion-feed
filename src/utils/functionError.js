// ─────────────────────────────────────────────
// Peolia — functionError
// src/utils/functionError.js
//
// supabase.functions.invoke() hides the response body on a non-2xx reply:
// `error.message` is just "Edge function returned a non-2xx status code" and the
// real { error: "..." } the function sent sits in error.context (a Response).
// This pulls the real message out so the UI can show what actually went wrong.
// ─────────────────────────────────────────────

export async function functionErrorMessage(error, data, fallback = 'Please try again.') {
  // 2xx reply that still carries an app-level error field.
  if (data?.error) return data.error;

  const ctx = error?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return body.error;
    } catch {
      // body wasn't JSON — fall through to the generic message
    }
  }
  return error?.message ?? fallback;
}

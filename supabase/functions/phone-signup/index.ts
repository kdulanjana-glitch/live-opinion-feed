import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

// Read the LAST x-forwarded-for entry: Supabase appends the real client IP at
// the end, and a caller can only spoof earlier values, not the last one.
function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (!xff) return 'unknown';
  const ips = xff.split(',').map((part) => part.trim());
  return ips[ips.length - 1];
}

// Always reply 200 with { success, error? }. functions.invoke() doesn't reliably
// surface a non-2xx body across versions, so the client checks `success` instead.
function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, password, email } = await req.json();

    if (!phone || !password || password.length < 8) {
      return jsonResponse({ success: false, error: 'Phone and a password of at least 8 characters are required.' });
    }

    const digits = digitsOnly(phone);
    if (digits.length < 8) {
      return jsonResponse({ success: false, error: 'That does not look like a valid phone number.' });
    }

    // Optional recovery email — validate only if provided.
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return jsonResponse({ success: false, error: 'That email address does not look valid.' });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Rate limit: max 3 attempts per IP per hour (tune the number freely).
    const ip = getClientIp(req);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count } = await supabaseAdmin
      .from('phone_signup_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('attempted_at', oneHourAgo);

    if ((count ?? 0) >= 3) {
      return jsonResponse({ success: false, error: 'Too many attempts from this connection. Try again later.' });
    }

    await supabaseAdmin.from('phone_signup_attempts').insert({ ip });

    const syntheticEmail = `${digits}@phone.peolia.invalid`;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: { phone: `+${digits}`, signup_method: 'phone' },
    });

    if (error) {
      const message = error.message?.toLowerCase().includes('already registered')
        ? 'That phone number is already registered.'
        : error.message;
      return jsonResponse({ success: false, error: message });
    }

    // Private profile fields live in user_private (own-row RLS); admin client
    // bypasses RLS. recovery_email is optional PII — kept private, never on users.
    const privateRow: Record<string, unknown> = { user_id: data.user.id, phone: `+${digits}` };
    if (email) privateRow.recovery_email = email.trim().toLowerCase();
    await supabaseAdmin.from('user_private').upsert(privateRow, { onConflict: 'user_id' });

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: 'Unexpected error creating account.' });
  }
});

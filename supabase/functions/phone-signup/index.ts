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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, password } = await req.json();

    if (!phone || !password || password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Phone and a password of at least 8 characters are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const digits = digitsOnly(phone);
    if (digits.length < 8) {
      return new Response(
        JSON.stringify({ error: 'That does not look like a valid phone number.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'Too many attempts from this connection. Try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      const message = error.message?.includes('already registered')
        ? 'That phone number is already registered.'
        : error.message;
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabaseAdmin
      .from('users')
      .update({ phone: `+${digits}` })
      .eq('id', data.user.id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Unexpected error creating account.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

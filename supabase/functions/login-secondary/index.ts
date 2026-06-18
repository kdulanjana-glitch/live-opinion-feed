import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

// Always reply 200 with { success, error?, session? } — the client checks success.
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
    const { identifier, password, type } = await req.json();
    if (!identifier || !password || !type) {
      return jsonResponse({ success: false, error: 'Missing credentials.' });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Resolve the owning account via the SECONDARY identifier:
    //  - type 'email' → an account whose user_private.recovery_email matches
    //  - type 'phone' → an account whose user_private.phone matches
    let userId: string | null = null;

    if (type === 'email') {
      const { data } = await supabaseAdmin
        .from('user_private')
        .select('user_id')
        .ilike('recovery_email', identifier)
        .limit(1)
        .maybeSingle();
      userId = data?.user_id ?? null;
    } else if (type === 'phone') {
      // Stored phones are E.164 (+digits); match on digits to be format-safe.
      const wanted = digitsOnly(identifier);
      const { data } = await supabaseAdmin
        .from('user_private')
        .select('user_id, phone')
        .not('phone', 'is', null);
      const row = (data ?? []).find((r) => digitsOnly(r.phone ?? '') === wanted);
      userId = row?.user_id ?? null;
    } else {
      return jsonResponse({ success: false, error: 'Unknown identifier type.' });
    }

    if (!userId) {
      return jsonResponse({ success: false, error: 'No account found.' });
    }

    // Look up that account's real login email (the synthetic one for phone
    // accounts, or the real address for email accounts).
    const { data: userRes, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    const loginEmail = userRes?.user?.email;
    if (getErr || !loginEmail) {
      return jsonResponse({ success: false, error: 'No account found.' });
    }

    // Verify the password by actually signing in on an anon client, which also
    // gives us a real session to hand back to the app.
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
      email: loginEmail,
      password,
    });
    if (signInErr || !signInData?.session) {
      return jsonResponse({ success: false, error: 'Incorrect password.' });
    }

    return jsonResponse({
      success: true,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    });
  } catch (err) {
    return jsonResponse({ success: false, error: 'Unexpected error.' });
  }
});

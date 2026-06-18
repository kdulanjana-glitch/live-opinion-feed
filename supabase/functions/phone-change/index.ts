import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

// Always reply 200 with { success, error? } — the client checks `success`.
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ success: false, error: 'Missing authorization.' });
    }
    const jwt = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    // Separate, anon-keyed client used only to verify the current password, so
    // signing in on it doesn't swap out the admin client's auth context.
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(jwt);
    if (callerError || !callerData?.user) {
      return jsonResponse({ success: false, error: 'Invalid or expired session.' });
    }
    const caller = callerData.user;

    if (!caller.email?.endsWith('@phone.peolia.invalid')) {
      return jsonResponse({ success: false, error: 'This account does not sign in with a phone number.' });
    }

    const { newPhone, currentPassword } = await req.json();
    if (!newPhone || !currentPassword) {
      return jsonResponse({ success: false, error: 'New phone number and current password are required.' });
    }

    const { error: passwordError } = await supabaseAnon.auth.signInWithPassword({
      email: caller.email,
      password: currentPassword,
    });
    if (passwordError) {
      return jsonResponse({ success: false, error: 'Current password is incorrect.' });
    }

    const newDigits = digitsOnly(newPhone);
    if (newDigits.length < 8) {
      return jsonResponse({ success: false, error: 'That does not look like a valid phone number.' });
    }
    const newSyntheticEmail = `${newDigits}@phone.peolia.invalid`;

    if (newSyntheticEmail === caller.email) {
      return jsonResponse({ success: false, error: 'That is already your current phone number.' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(caller.id, {
      email: newSyntheticEmail,
      email_confirm: true,
    });

    if (updateError) {
      const message = updateError.message?.toLowerCase().includes('already')
        ? 'That phone number is already in use.'
        : updateError.message;
      return jsonResponse({ success: false, error: message });
    }

    // Phone lives in the private table (own-row RLS); admin client bypasses RLS.
    await supabaseAdmin
      .from('user_private')
      .upsert({ user_id: caller.id, phone: `+${newDigits}` }, { onConflict: 'user_id' });

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: 'Unexpected error updating phone number.' });
  }
});
